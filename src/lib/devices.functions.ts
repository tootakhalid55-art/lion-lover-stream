/**
 * Device management server functions. Every mutating fn is RBAC-gated
 * (via `canManageDevices` capability) and writes to the audit trail.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability, getCapabilities } from "@/lib/rbac.server";
import { writeAudit, writeSecurityEvent, emitNotification } from "@/lib/audit.server";
import { z } from "zod";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { userId?: string; search?: string; status?: "all" | "trusted" | "blocked" | "active" }) =>
    z.object({
      userId: z.string().uuid().optional(),
      search: z.string().max(64).optional(),
      status: z.enum(["all", "trusted", "blocked", "active"]).optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canViewSecurity");
    const admin = await getAdmin();
    let q = admin
      .from("user_devices")
      .select("*, profiles:user_id(username, display_name, status)")
      .order("last_seen", { ascending: false })
      .limit(500);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.status === "trusted") q = q.not("trusted_at", "is", null);
    if (data.status === "blocked") q = q.not("blocked_at", "is", null);
    if (data.status === "active") q = q.is("blocked_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let filtered = rows ?? [];
    if (data.search) {
      const s = data.search.toLowerCase();
      filtered = filtered.filter((r: any) =>
        [r.device_name, r.name, r.os, r.browser, r.ip, r.country, r.profiles?.username]
          .filter(Boolean).some((v: string) => v.toLowerCase().includes(s)),
      );
    }
    return filtered;
  });

export const renameDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1).max(80) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageDevices");
    const admin = await getAdmin();
    const before = await admin.from("user_devices").select("name, user_id").eq("id", data.id).maybeSingle();
    const { error } = await admin.from("user_devices").update({ name: data.name }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorId: context.userId, action: "device_rename",
      targetUserId: before.data?.user_id ?? null,
      before: { name: before.data?.name }, after: { name: data.name },
    });
    return { ok: true as const };
  });

export const trustDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; trusted: boolean }) =>
    z.object({ id: z.string().uuid(), trusted: z.boolean() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageDevices");
    const admin = await getAdmin();
    const before = await admin.from("user_devices").select("trusted_at, user_id").eq("id", data.id).maybeSingle();
    const trusted_at = data.trusted ? new Date().toISOString() : null;
    const { error } = await admin.from("user_devices").update({ trusted_at }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorId: context.userId, action: data.trusted ? "device_trust" : "device_untrust",
      targetUserId: before.data?.user_id ?? null,
      before: { trusted_at: before.data?.trusted_at }, after: { trusted_at },
    });
    return { ok: true as const };
  });

export const revokeDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; reason?: string }) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(200).optional() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageDevices");
    const admin = await getAdmin();
    const before = await admin.from("user_devices").select("*").eq("id", data.id).maybeSingle();
    if (!before.data) throw new Error("Device not found");
    const now = new Date().toISOString();
    await admin.from("user_devices").update({ blocked_at: now }).eq("id", data.id);
    await admin.from("user_sessions")
      .update({ revoked_at: now, revoked_by: context.userId, revoked_reason: data.reason || "device_revoked" })
      .eq("user_id", before.data.user_id).eq("device_id", before.data.device_id).is("revoked_at", null);
    await writeAudit({
      actorId: context.userId, action: "device_revoke",
      targetUserId: before.data.user_id,
      before: { blocked_at: before.data.blocked_at }, after: { blocked_at: now },
      meta: { reason: data.reason ?? null, device_id: before.data.device_id },
    });
    await writeSecurityEvent({ userId: before.data.user_id, kind: "device_revoked", severity: "warn", meta: { device_id: before.data.device_id } });
    await emitNotification({
      userId: before.data.user_id, kind: "device_revoked", severity: "warn",
      title: "تم إلغاء تسجيل جهاز", body: `الجهاز ${before.data.name || before.data.device_name || ""} أُلغي.`,
    });
    return { ok: true as const };
  });

export const unblockDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageDevices");
    const admin = await getAdmin();
    const before = await admin.from("user_devices").select("blocked_at, user_id").eq("id", data.id).maybeSingle();
    await admin.from("user_devices").update({ blocked_at: null }).eq("id", data.id);
    await writeAudit({ actorId: context.userId, action: "device_unblock", targetUserId: before.data?.user_id ?? null,
      before: { blocked_at: before.data?.blocked_at }, after: { blocked_at: null } });
    return { ok: true as const };
  });

export const forceLogoutDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageDevices");
    const admin = await getAdmin();
    const d = await admin.from("user_devices").select("user_id, device_id").eq("id", data.id).maybeSingle();
    if (!d.data) throw new Error("Device not found");
    const now = new Date().toISOString();
    await admin.from("user_sessions")
      .update({ revoked_at: now, revoked_by: context.userId, revoked_reason: "force_logout_device" })
      .eq("user_id", d.data.user_id).eq("device_id", d.data.device_id).is("revoked_at", null);
    await writeAudit({ actorId: context.userId, action: "device_force_logout", targetUserId: d.data.user_id, meta: { device_id: d.data.device_id } });
    await writeSecurityEvent({ userId: d.data.user_id, kind: "session_revoked", severity: "info", meta: { reason: "force_logout_device" } });
    return { ok: true as const };
  });

export const myCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { roles, caps } = await getCapabilities(context);
    return { roles, caps };
  });
