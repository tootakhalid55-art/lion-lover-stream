/**
 * Licensing server functions:
 * packages, licenses, activation codes, redemption.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateActivationCode, generateLicenseKey, computeExpiry } from "@/lib/licensing.server";
import { usernameToEmail, type AccountStatus } from "@/lib/auth-utils";

// ─── shared helpers (kept small, no cross-fn deps) ──────────────────────
async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function assertStaff(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  const roles = (data ?? []).map((r: any) => r.role as string);
  if (!roles.some((r: string) => ["super_admin", "admin", "moderator"].includes(r))) throw new Error("Forbidden");
}
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  const roles = (data ?? []).map((r: any) => r.role as string);
  if (!roles.some((r: string) => ["super_admin", "admin"].includes(r))) throw new Error("Forbidden");
}
async function audit(action: string, target: string | null, meta: any, actor: string | null) {
  const admin = await getAdmin();
  await admin.from("audit_logs").insert({ action, target_user_id: target, meta, actor_id: actor }).then(() => {}, (e: any) => console.error("[audit]", e));
}

// ─── Packages ───────────────────────────────────────────────────────────
export const listPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const admin = await getAdmin();
    const { data, error } = await admin.from("packages").select("*").order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const pkgSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  tier: z.enum(["trial","monthly","quarterly","semi_annual","annual","lifetime","custom"]),
  duration_days: z.number().int().positive().nullable(),
  max_devices: z.number().int().min(1).max(50),
  max_sessions: z.number().int().min(1).max(50),
  simultaneous_streams: z.number().int().min(1).max(20),
  allow_download: z.boolean(),
  allow_recording: z.boolean(),
  allowed_features: z.array(z.string()).default([]),
  allowed_categories: z.array(z.string()).default([]),
  price_cents: z.number().int().min(0),
  currency: z.string().min(3).max(3),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  notes: z.string().max(2000).optional().nullable(),
});
export const upsertPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => pkgSchema.parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { data: row, error } = await admin.from("packages").upsert(data as any).select().single();
    if (error) throw new Error(error.message);
    await audit(data.id ? "update_package" : "create_package", null, { id: row.id, name: row.name }, context.userId);
    return row;
  });

export const deletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { error } = await admin.from("packages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("delete_package", null, { id: data.id }, context.userId);
    return { ok: true as const };
  });

// ─── Licenses ───────────────────────────────────────────────────────────
export const listLicenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { status?: string; search?: string; expiringDays?: number | null }) =>
    z.object({
      status: z.enum(["all","active","expired","revoked","pending"]).optional(),
      search: z.string().max(120).optional(),
      expiringDays: z.number().int().min(1).max(365).nullable().optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const admin = await getAdmin();
    let q = admin.from("licenses").select(
      "id, license_key, license_type, status, activated_at, expires_at, auto_renew, user_id, package_id, notes, created_at, profiles!inner(username, display_name), packages(name, tier, duration_days)"
    ).order("created_at", { ascending: false }).limit(500);
    if (data.status && data.status !== "all") q = q.eq("status", data.status as any);
    if (data.expiringDays) {
      const until = new Date(Date.now() + data.expiringDays * 86400_000).toISOString();
      q = q.eq("status", "active").not("expires_at", "is", null).lte("expires_at", until);
    }
    if (data.search) q = q.or(`license_key.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const issueLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { userId: string; packageId: string; overrideDays?: number | null; autoRenew?: boolean; type?: "trial"|"paid"|"lifetime"|"comp" }) =>
    z.object({
      userId: z.string().uuid(),
      packageId: z.string().uuid(),
      overrideDays: z.number().int().positive().nullable().optional(),
      autoRenew: z.boolean().optional(),
      type: z.enum(["trial","paid","lifetime","comp"]).optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { data: pkg, error: pErr } = await admin.from("packages").select("*").eq("id", data.packageId).single();
    if (pErr || !pkg) throw new Error("الباقة غير موجودة");
    const days = data.overrideDays ?? pkg.duration_days;
    const expiresAt = pkg.tier === "lifetime" ? null : computeExpiry(days);
    const licenseType = data.type ?? (pkg.tier === "lifetime" ? "lifetime" : pkg.tier === "trial" ? "trial" : "paid");
    const key = generateLicenseKey();
    const { data: lic, error } = await admin.from("licenses").insert({
      user_id: data.userId, package_id: pkg.id, license_key: key,
      license_type: licenseType, status: "active", expires_at: expiresAt,
      auto_renew: data.autoRenew ?? false, issued_by: context.userId,
    }).select().single();
    if (error) throw new Error(error.message);
    // Sync profile: package_id + expires_at + status
    await admin.from("profiles").update({
      package_id: pkg.id,
      expires_at: expiresAt,
      status: "active" as AccountStatus,
    }).eq("id", data.userId);
    await audit("issue_license", data.userId, { key, packageId: pkg.id }, context.userId);
    return lic;
  });

export const renewLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; days?: number | null; packageId?: string }) =>
    z.object({ id: z.string().uuid(), days: z.number().int().positive().nullable().optional(), packageId: z.string().uuid().optional() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { data: lic, error } = await admin.from("licenses").select("*, packages(*)").eq("id", data.id).single();
    if (error || !lic) throw new Error("الرخصة غير موجودة");
    let pkg: any = lic.packages;
    if (data.packageId && data.packageId !== lic.package_id) {
      const { data: newPkg } = await admin.from("packages").select("*").eq("id", data.packageId).single();
      if (!newPkg) throw new Error("الباقة الجديدة غير موجودة");
      pkg = newPkg;
    }
    const days = data.days ?? pkg?.duration_days ?? null;
    const base = lic.expires_at && new Date(lic.expires_at) > new Date() ? new Date(lic.expires_at) : new Date();
    const expires = pkg?.tier === "lifetime" || days == null ? null : computeExpiry(days, base);
    const { error: uErr } = await admin.from("licenses").update({
      package_id: pkg?.id ?? lic.package_id,
      expires_at: expires,
      status: "active",
      activated_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (uErr) throw new Error(uErr.message);
    await admin.from("profiles").update({
      package_id: pkg?.id ?? lic.package_id,
      expires_at: expires,
      status: "active" as AccountStatus,
    }).eq("id", lic.user_id);
    await audit("renew_license", lic.user_id, { id: data.id, days, expires }, context.userId);
    return { ok: true as const, expires_at: expires };
  });

export const revokeLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { data: lic } = await admin.from("licenses").select("user_id").eq("id", data.id).single();
    await admin.from("licenses").update({ status: "revoked" }).eq("id", data.id);
    if (lic) await admin.from("profiles").update({ status: "disabled" as AccountStatus }).eq("id", lic.user_id);
    await audit("revoke_license", lic?.user_id ?? null, { id: data.id }, context.userId);
    return { ok: true as const };
  });

// ─── Activation codes ───────────────────────────────────────────────────
export const listActivationCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const admin = await getAdmin();
    const { data, error } = await admin.from("activation_codes")
      .select("*, packages(name, tier)")
      .order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createActivationCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { packageId: string; count: number; overrideDays?: number | null; expiresAt?: string | null; notes?: string }) =>
    z.object({
      packageId: z.string().uuid(),
      count: z.number().int().min(1).max(500),
      overrideDays: z.number().int().positive().nullable().optional(),
      expiresAt: z.string().datetime().nullable().optional(),
      notes: z.string().max(2000).optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const rows = Array.from({ length: data.count }, () => ({
      code: generateActivationCode(),
      package_id: data.packageId,
      duration_override_days: data.overrideDays ?? null,
      expires_at: data.expiresAt ?? null,
      notes: data.notes ?? null,
      created_by: context.userId,
    }));
    const { data: inserted, error } = await admin.from("activation_codes").insert(rows).select("code, package_id");
    if (error) throw new Error(error.message);
    await audit("create_activation_codes", null, { count: data.count, packageId: data.packageId }, context.userId);
    return inserted ?? [];
  });

export const revokeActivationCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const admin = await getAdmin();
    const { error } = await admin.from("activation_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("revoke_activation_code", null, { id: data.id }, context.userId);
    return { ok: true as const };
  });

/** Public: redeem code → creates account + license. Returns credentials. */
export const redeemActivationCode = createServerFn({ method: "POST" })
  .inputValidator((v: { code: string; username?: string; displayName?: string; email?: string; phone?: string }) =>
    z.object({
      code: z.string().min(4).max(64),
      username: z.string().min(3).max(32).regex(/^[a-z0-9_.-]+$/i).optional(),
      displayName: z.string().max(80).optional(),
      email: z.string().email().max(200).optional().or(z.literal("")),
      phone: z.string().max(40).optional().or(z.literal("")),
    }).parse(v),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const normalized = data.code.trim().toUpperCase();
    const { data: code, error } = await admin.from("activation_codes")
      .select("*, packages(*)")
      .eq("code", normalized).single();
    if (error || !code) throw new Error("رمز التفعيل غير صالح");
    if (code.expires_at && new Date(code.expires_at) < new Date()) throw new Error("انتهت صلاحية الرمز");
    if (code.uses_count >= code.uses_allowed) throw new Error("تم استخدام الرمز بالفعل");
    const pkg = code.packages;
    if (!pkg) throw new Error("الباقة المرتبطة غير موجودة");

    // Generate username + password
    const buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    const username = (data.username || `nova${(buf[0] % 90000) + 10000}`).toLowerCase();
    const password = data.username && data.username.length > 0
      ? Array.from(crypto.getRandomValues(new Uint8Array(9))).map((n) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$"[n % 60]).join("")
      : Array.from(crypto.getRandomValues(new Uint8Array(9))).map((n) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$"[n % 60]).join("");
    const email = usernameToEmail(username);
    const { data: created, error: uErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { username, display_name: data.displayName || username },
    });
    if (uErr || !created.user) throw new Error(uErr?.message || "فشل إنشاء الحساب");
    const days = code.duration_override_days ?? pkg.duration_days;
    const expiresAt = pkg.tier === "lifetime" ? null : computeExpiry(days);
    await admin.from("profiles").upsert({
      id: created.user.id, username,
      display_name: data.displayName || username,
      email: data.email || null, phone: data.phone || null,
      status: "active" as AccountStatus,
      package_id: pkg.id,
      activated_at: new Date().toISOString(),
      expires_at: expiresAt,
    }, { onConflict: "id" });
    const key = generateLicenseKey();
    await admin.from("licenses").insert({
      user_id: created.user.id, package_id: pkg.id, license_key: key,
      license_type: pkg.tier === "lifetime" ? "lifetime" : pkg.tier === "trial" ? "trial" : "paid",
      status: "active", expires_at: expiresAt, issued_by: null,
    });
    await admin.from("activation_codes").update({
      uses_count: code.uses_count + 1,
      redeemed_by: created.user.id,
      redeemed_at: new Date().toISOString(),
    }).eq("id", code.id);
    await audit("redeem_activation_code", created.user.id, { code: normalized, packageId: pkg.id }, null);
    return { ok: true as const, username, password, licenseKey: key, packageName: pkg.name, expiresAt };
  });
