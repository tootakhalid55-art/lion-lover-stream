/**
 * Nova TV licensing server functions.
 *
 * - `login` binds device / enforces status / expiration / single-device.
 * - Admin fns are gated by `requireSupabaseAuth` + a role check via the
 *   caller's own Supabase client (RLS). Only after that check do we lazily
 *   import `supabaseAdmin` for privileged writes.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimit, clientKey } from "@/lib/rate-limit.server";
import { z } from "zod";
import { usernameToEmail, type AccountStatus, type AppRole } from "@/lib/auth-utils";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

function clientIp(): string {
  return (
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-real-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    getRequestIP({ xForwardedFor: true }) ||
    "unknown"
  );
}
function clientUA(): string {
  return getRequestHeader("user-agent") || "unknown";
}

// ─── Server-side helpers ────────────────────────────────────────────────
async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertStaff(ctx: { supabase: any; userId: string }): Promise<AppRole[]> {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (error) throw new Error("Forbidden");
  const roles = (data ?? []).map((r: { role: AppRole }) => r.role);
  if (!roles.some((r: AppRole) => r === "super_admin" || r === "admin" || r === "moderator"))
    throw new Error("Forbidden");
  return roles;
}
async function assertAdmin(ctx: { supabase: any; userId: string }): Promise<AppRole[]> {
  const roles = await assertStaff(ctx);
  if (!roles.some((r) => r === "super_admin" || r === "admin")) throw new Error("Forbidden");
  return roles;
}

async function audit(action: string, target_user_id: string | null, meta: any, actor_id: string | null = null) {
  try {
    const admin = await getAdmin();
    await admin.from("audit_logs").insert({ action, target_user_id, meta, actor_id, ip: clientIp(), user_agent: clientUA() });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}
async function secEvent(userId: string | null, kind: string, severity: "info" | "warn" | "critical" = "info", meta: any = {}) {
  try {
    const admin = await getAdmin();
    await admin.from("security_events").insert({ user_id: userId, kind, severity, ip: clientIp(), user_agent: clientUA(), meta });
  } catch (e) { console.error("[sec] failed", e); }
}
async function notify(userId: string | null, kind: string, title: string, body?: string, severity: "info" | "warn" | "critical" = "info") {
  try {
    const admin = await getAdmin();
    await admin.from("notifications").insert({ user_id: userId, kind, title, body: body ?? null, severity });
  } catch (e) { console.error("[notify] failed", e); }
}

// ─── Password generator ─────────────────────────────────────────────────
function genPassword(len = 12) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digit = "23456789";
  const sym = "!@#$%^&*";
  const all = upper + lower + digit + sym;
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  const chars: string[] = [
    upper[buf[0] % upper.length],
    lower[buf[1] % lower.length],
    digit[buf[2] % digit.length],
    sym[buf[3] % sym.length],
  ];
  for (let i = 4; i < len; i++) chars.push(all[buf[i] % all.length]);
  return chars.sort(() => (crypto.getRandomValues(new Uint32Array(1))[0] & 1) - 0.5).join("");
}
function genUsername() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return `nova${(buf[0] % 90000) + 10000}`;
}

// ─── Public: bootstrap first super admin ────────────────────────────────
export const bootstrapSuperAdmin = createServerFn({ method: "POST" })
  .inputValidator((v: { username: string; password: string; code: string }) =>
    z
      .object({
        username: z.string().min(3).max(32).regex(/^[a-z0-9_.-]+$/i),
        password: z.string().min(8).max(128),
        code: z.string().min(8),
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const rl = rateLimit(`bootstrap:${clientIp()}`, { capacity: 5, refillPerSec: 1 / 60 });
    if (!rl.allowed) throw new Error("Too many attempts");
    const expected = process.env.NOVA_ADMIN_BOOTSTRAP_CODE;
    if (!expected || data.code !== expected) throw new Error("Invalid bootstrap code");
    const admin = await getAdmin();
    const { count } = await admin.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "super_admin");
    if ((count ?? 0) > 0) throw new Error("Super admin already exists");
    const email = usernameToEmail(data.username);
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username.toLowerCase(), display_name: data.username },
    });
    if (error || !created.user) throw new Error(error?.message || "Failed to create user");
    await admin.from("profiles").upsert(
      { id: created.user.id, username: data.username.toLowerCase(), display_name: data.username, status: "active" as AccountStatus },
      { onConflict: "id" },
    );
    await admin.from("user_roles").insert({ user_id: created.user.id, role: "super_admin" as AppRole });
    await audit("bootstrap_super_admin", created.user.id, { username: data.username });
    return { ok: true as const };
  });

// ─── login: resolve username → email, enforce status/device ─────────────
export const resolveLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((v: { username: string }) => z.object({ username: z.string().min(1).max(64) }).parse(v))
  .handler(async ({ data }) => {
    const key = `login:${clientIp()}:${data.username.toLowerCase()}`;
    const rl = rateLimit(key, { capacity: 10, refillPerSec: 1 / 30 });
    if (!rl.allowed) throw new Error(`Too many attempts. Retry in ${Math.ceil(rl.retryAfterMs / 1000)}s`);
    const admin = await getAdmin();
    const { data: p } = await admin
      .from("profiles")
      .select("id, status, locked_until, expires_at")
      .eq("username", data.username.toLowerCase())
      .maybeSingle();
    if (!p) {
      await admin.from("login_attempts").insert({ username: data.username, ip: clientIp(), success: false, reason: "no_user", user_agent: clientUA() });
      throw new Error("بيانات الدخول غير صحيحة");
    }
    if (p.locked_until && new Date(p.locked_until) > new Date()) throw new Error("الحساب مقفول مؤقتًا. حاول لاحقًا.");
    if (p.status === "suspended") throw new Error("الحساب معلّق. تواصل مع الإدارة.");
    if (p.status === "disabled") throw new Error("الحساب معطّل.");
    if (p.expires_at && new Date(p.expires_at) < new Date()) {
      await admin.from("profiles").update({ status: "expired" as AccountStatus }).eq("id", p.id);
      throw new Error("انتهى اشتراكك.");
    }
    return { email: usernameToEmail(data.username) };
  });

/** After Supabase sign-in on the client, validate + bind device server-side. */
export const finalizeLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { deviceId: string; deviceName: string; os: string; browser: string }) =>
    z.object({ deviceId: z.string().min(4), deviceName: z.string().max(200), os: z.string().max(64), browser: z.string().max(64) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const uid = context.userId;
    const { data: profile } = await admin
      .from("profiles")
      .select("*, packages(max_devices, max_sessions)")
      .eq("id", uid)
      .maybeSingle();
    if (!profile) throw new Error("الحساب غير موجود");

    // Expiration
    if (profile.expires_at && new Date(profile.expires_at) < new Date()) {
      await admin.from("profiles").update({ status: "expired" }).eq("id", uid);
      throw new Error("انتهى اشتراكك.");
    }
    if (profile.status !== "active") throw new Error("الحساب غير مفعّل.");

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid);
    const isStaff = (roles ?? []).some((r: any) => ["super_admin", "admin", "moderator"].includes(r.role));
    const pkg: any = (profile as any).packages ?? null;
    const maxDevices = isStaff ? 999 : Math.max(1, pkg?.max_devices ?? 1);
    const maxSessions = isStaff ? 999 : Math.max(1, pkg?.max_sessions ?? maxDevices);

    // Devices: allow same device, otherwise enforce limit
    const { data: devices } = await admin.from("user_devices").select("*").eq("user_id", uid);
    const existing = (devices ?? []).find((d: any) => d.device_id === data.deviceId);
    if (existing?.blocked_at) {
      await admin.from("login_attempts").insert({ username: profile.username, ip: clientIp(), success: false, reason: "device_blocked", user_agent: clientUA() });
      throw new Error("هذا الجهاز محظور من قبل الإدارة.");
    }
    if (!existing && (devices?.length ?? 0) >= maxDevices) {
      await admin.from("login_attempts").insert({ username: profile.username, ip: clientIp(), success: false, reason: "device_limit", user_agent: clientUA() });
      throw new Error(`وصلت للحد الأقصى للأجهزة (${maxDevices}). أزل جهازًا سابقًا أو تواصل مع الإدارة.`);
    }
    await admin.from("user_devices").upsert(
      {
        user_id: uid,
        device_id: data.deviceId,
        device_name: data.deviceName,
        os: data.os,
        browser: data.browser,
        ip: clientIp(),
        last_seen: new Date().toISOString(),
      },
      { onConflict: "user_id,device_id" },
    );

    // Sessions: cap to maxSessions — revoke oldest active if over the cap
    const { data: activeSessions } = await admin
      .from("user_sessions")
      .select("id, device_id, created_at")
      .eq("user_id", uid)
      .is("revoked_at", null)
      .order("created_at", { ascending: true });
    // Always revoke prior session on the same device
    const sameDevice = (activeSessions ?? []).filter((s: any) => s.device_id === data.deviceId);
    if (sameDevice.length) {
      await admin.from("user_sessions").update({ revoked_at: new Date().toISOString() }).in("id", sameDevice.map((s: any) => s.id));
    }
    const remaining = (activeSessions ?? []).filter((s: any) => s.device_id !== data.deviceId);
    const overflow = remaining.length - (maxSessions - 1);
    if (overflow > 0) {
      const toRevoke = remaining.slice(0, overflow).map((s: any) => s.id);
      await admin.from("user_sessions").update({ revoked_at: new Date().toISOString() }).in("id", toRevoke);
    }
    await admin.from("user_sessions").insert({
      user_id: uid, device_id: data.deviceId, ip: clientIp(), user_agent: clientUA(),
    });
    await admin.from("profiles").update({ last_login_at: new Date().toISOString(), last_ip: clientIp(), failed_attempts: 0 }).eq("id", uid);
    await admin.from("login_attempts").insert({ username: profile.username, ip: clientIp(), success: true, user_agent: clientUA() });

    return { ok: true as const };
  });

/** Return the current user + role summary. Used by the client-side gate. */
export const me = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    const uid = context.userId;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      admin.from("profiles").select("id, username, display_name, status, expires_at, last_login_at, email, phone").eq("id", uid).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", uid),
    ]);
    if (!profile) return null;
    return {
      ...profile,
      roles: (roles ?? []).map((r: any) => r.role as AppRole),
      isStaff: (roles ?? []).some((r: any) => ["super_admin", "admin", "moderator"].includes(r.role)),
      isAdmin: (roles ?? []).some((r: any) => ["super_admin", "admin"].includes(r.role)),
      isSuperAdmin: (roles ?? []).some((r: any) => r.role === "super_admin"),
    };
  });

// ─── Admin: users ───────────────────────────────────────────────────────
export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { search?: string; status?: AccountStatus | "all" }) =>
    z.object({ search: z.string().max(64).optional(), status: z.enum(["active","suspended","expired","disabled","locked","all"]).optional() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const admin = await getAdmin();
    let q = admin
      .from("profiles")
      .select("id, username, display_name, email, phone, status, expires_at, activated_at, last_login_at, last_ip, created_at, package_id, packages(name, tier, max_devices)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.search) q = q.ilike("username", `%${data.search.toLowerCase()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r: any) => r.id);
    const [{ data: devices }, { data: sessions }] = await Promise.all([
      admin.from("user_devices").select("user_id, device_name, os, browser, last_seen").in("user_id", ids),
      admin.from("user_sessions").select("user_id, last_seen").in("user_id", ids).is("revoked_at", null),
    ]);
    const devByUser = new Map<string, any>();
    (devices ?? []).forEach((d: any) => {
      const prev = devByUser.get(d.user_id);
      if (!prev || new Date(d.last_seen) > new Date(prev.last_seen)) devByUser.set(d.user_id, d);
    });
    const cutoff = Date.now() - 5 * 60 * 1000;
    const onlineSet = new Set((sessions ?? []).filter((s: any) => new Date(s.last_seen).getTime() > cutoff).map((s: any) => s.user_id));
    const deviceCount = new Map<string, number>();
    (devices ?? []).forEach((d: any) => deviceCount.set(d.user_id, (deviceCount.get(d.user_id) ?? 0) + 1));
    return (rows ?? []).map((r: any) => ({
      ...r,
      device: devByUser.get(r.id) ?? null,
      deviceCount: deviceCount.get(r.id) ?? 0,
      online: onlineSet.has(r.id),
    }));
  });

export const adminGetUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const admin = await getAdmin();
    const [profile, device, sessions, attempts] = await Promise.all([
      admin.from("profiles").select("*").eq("id", data.id).maybeSingle(),
      admin.from("user_devices").select("*").eq("user_id", data.id).maybeSingle(),
      admin.from("user_sessions").select("*").eq("user_id", data.id).order("created_at", { ascending: false }).limit(20),
      admin.from("login_attempts").select("*").order("created_at", { ascending: false }).limit(20).eq("username", (await admin.from("profiles").select("username").eq("id", data.id).maybeSingle()).data?.username ?? ""),
    ]);
    return {
      profile: profile.data,
      device: device.data,
      sessions: sessions.data ?? [],
      attempts: attempts.data ?? [],
    };
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: {
    username?: string; password?: string; displayName?: string; email?: string; phone?: string;
    durationDays?: number | null; packageId?: string | null; notes?: string;
  }) =>
    z
      .object({
        username: z.string().min(3).max(32).regex(/^[a-z0-9_.-]+$/i).optional(),
        password: z.string().min(8).max(128).optional(),
        displayName: z.string().max(80).optional(),
        email: z.string().email().max(200).optional().or(z.literal("")),
        phone: z.string().max(40).optional().or(z.literal("")),
        durationDays: z.number().int().positive().nullable().optional(),
        packageId: z.string().uuid().nullable().optional(),
        notes: z.string().max(2000).optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const username = (data.username || genUsername()).toLowerCase();
    const password = data.password || genPassword(12);
    const email = usernameToEmail(username);

    // Package overrides raw duration
    let pkg: any = null;
    if (data.packageId) {
      const { data: p } = await admin.from("packages").select("*").eq("id", data.packageId).single();
      pkg = p;
    }
    const days = pkg ? pkg.duration_days : data.durationDays ?? null;
    const expires_at = pkg?.tier === "lifetime" ? null : days ? new Date(Date.now() + days * 86400_000).toISOString() : null;

    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { username, display_name: data.displayName || username },
    });
    if (error || !created.user) throw new Error(error?.message || "Failed to create user");
    await admin.from("profiles").upsert(
      {
        id: created.user.id, username,
        display_name: data.displayName || username,
        email: data.email || null,
        phone: data.phone || null,
        status: "active" as AccountStatus,
        package_id: pkg?.id ?? null,
        expires_at,
        activated_at: new Date().toISOString(),
        notes: data.notes || null,
      },
      { onConflict: "id" },
    );

    // Issue license row if package chosen
    if (pkg) {
      const { generateLicenseKey } = await import("@/lib/licensing.server");
      await admin.from("licenses").insert({
        user_id: created.user.id, package_id: pkg.id, license_key: generateLicenseKey(),
        license_type: pkg.tier === "lifetime" ? "lifetime" : pkg.tier === "trial" ? "trial" : "paid",
        status: "active", expires_at, issued_by: context.userId,
      });
    }

    await audit("create_user", created.user.id, { username, packageId: pkg?.id ?? null, durationDays: days }, context.userId);
    return { ok: true as const, id: created.user.id, username, password, expires_at, packageName: pkg?.name ?? null };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: {
    id: string; displayName?: string; email?: string | null; phone?: string | null; notes?: string | null;
    status?: AccountStatus; durationDays?: number | null; packageId?: string | null;
  }) =>
    z.object({
      id: z.string().uuid(),
      displayName: z.string().max(80).optional(),
      email: z.string().max(200).optional().nullable(),
      phone: z.string().max(40).optional().nullable(),
      notes: z.string().max(2000).optional().nullable(),
      status: z.enum(["active","suspended","expired","disabled","locked"]).optional(),
      durationDays: z.number().int().positive().nullable().optional(),
      packageId: z.string().uuid().nullable().optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const patch: Record<string, any> = {};
    if (data.displayName !== undefined) patch.display_name = data.displayName;
    if (data.email !== undefined) patch.email = data.email || null;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    if (data.notes !== undefined) patch.notes = data.notes || null;
    if (data.status !== undefined) patch.status = data.status;
    if (data.packageId !== undefined) patch.package_id = data.packageId;
    if (data.durationDays !== undefined) {
      patch.expires_at = data.durationDays === null ? null : new Date(Date.now() + data.durationDays * 86400_000).toISOString();
    }
    const { error } = await admin.from("profiles").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("update_user", data.id, patch, context.userId);
    return { ok: true as const };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; password?: string }) => z.object({ id: z.string().uuid(), password: z.string().min(8).max(128).optional() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const password = data.password || genPassword(12);
    const { error } = await admin.auth.admin.updateUserById(data.id, { password });
    if (error) throw new Error(error.message);
    await audit("reset_password", data.id, {}, context.userId);
    return { ok: true as const, password };
  });

export const adminResetDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    await admin.from("user_devices").delete().eq("user_id", data.id);
    await audit("reset_device", data.id, {}, context.userId);
    return { ok: true as const };
  });

export const adminForceLogout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    await admin.auth.admin.signOut(data.id).catch(() => {});
    await admin.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", data.id).is("revoked_at", null);
    await audit("force_logout", data.id, {}, context.userId);
    return { ok: true as const };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { error } = await admin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    await audit("delete_user", data.id, {}, context.userId);
    return { ok: true as const };
  });

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const admin = await getAdmin();
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
    const [total, active, suspended, expired, devices, sessions, online, newToday] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("profiles").select("*", { count: "exact", head: true }).eq("status", "active"),
      admin.from("profiles").select("*", { count: "exact", head: true }).eq("status", "suspended"),
      admin.from("profiles").select("*", { count: "exact", head: true }).eq("status", "expired"),
      admin.from("user_devices").select("*", { count: "exact", head: true }),
      admin.from("user_sessions").select("*", { count: "exact", head: true }).is("revoked_at", null),
      admin.from("user_sessions").select("*", { count: "exact", head: true }).is("revoked_at", null).gt("last_seen", cutoff),
      admin.from("profiles").select("*", { count: "exact", head: true }).gt("created_at", todayStart.toISOString()),
    ]);
    return {
      total: total.count ?? 0, active: active.count ?? 0, suspended: suspended.count ?? 0, expired: expired.count ?? 0,
      devices: devices.count ?? 0, sessions: sessions.count ?? 0, online: online.count ?? 0, newToday: newToday.count ?? 0,
    };
  });

/** Heartbeat: update session last_seen so "online" count is fresh. */
export const heartbeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await admin.from("user_sessions").update({ last_seen: new Date().toISOString() }).eq("user_id", context.userId).is("revoked_at", null);
    return { ok: true as const };
  });
