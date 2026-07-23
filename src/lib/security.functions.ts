/**
 * Security Center: event log, KPIs, account locking.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability } from "@/lib/rbac.server";
import { writeAudit, writeSecurityEvent, emitNotification } from "@/lib/audit.server";
import { z } from "zod";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listSecurityEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { kind?: string; userId?: string; from?: string; to?: string; search?: string; limit?: number }) =>
    z.object({
      kind: z.string().max(64).optional(),
      userId: z.string().uuid().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      search: z.string().max(64).optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canViewSecurity");
    const admin = await getAdmin();
    let q = admin
      .from("security_events")
      .select("*, profiles:user_id(username, display_name)")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 500);
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let filtered = rows ?? [];
    if (data.search) {
      const s = data.search.toLowerCase();
      filtered = filtered.filter((r: any) =>
        [r.kind, r.ip, r.user_agent, r.country, r.profiles?.username]
          .filter(Boolean).some((v: string) => v.toLowerCase().includes(s)),
      );
    }
    return filtered;
  });

export const securityKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCapability(context, "canViewSecurity");
    const admin = await getAdmin();
    const dayAgo = new Date(Date.now() - 86400_000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const [failed24, success24, locks24, newDevices7, suspicious7, pwChanges7] = await Promise.all([
      admin.from("security_events").select("*", { count: "exact", head: true }).eq("kind", "failed_login").gt("created_at", dayAgo),
      admin.from("security_events").select("*", { count: "exact", head: true }).eq("kind", "successful_login").gt("created_at", dayAgo),
      admin.from("security_events").select("*", { count: "exact", head: true }).eq("kind", "account_locked").gt("created_at", dayAgo),
      admin.from("security_events").select("*", { count: "exact", head: true }).eq("kind", "new_device").gt("created_at", weekAgo),
      admin.from("security_events").select("*", { count: "exact", head: true }).eq("kind", "suspicious").gt("created_at", weekAgo),
      admin.from("security_events").select("*", { count: "exact", head: true }).eq("kind", "password_change").gt("created_at", weekAgo),
    ]);
    return {
      failedLogins24h: failed24.count ?? 0,
      successfulLogins24h: success24.count ?? 0,
      accountLocks24h: locks24.count ?? 0,
      newDevices7d: newDevices7.count ?? 0,
      suspicious7d: suspicious7.count ?? 0,
      passwordChanges7d: pwChanges7.count ?? 0,
    };
  });

export const lockAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { userId: string; minutes?: number; reason?: string }) =>
    z.object({
      userId: z.string().uuid(),
      minutes: z.number().int().min(1).max(24 * 60 * 30).optional(),
      reason: z.string().max(200).optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageUsers");
    const admin = await getAdmin();
    const until = new Date(Date.now() + (data.minutes ?? 60) * 60_000).toISOString();
    await admin.from("profiles").update({ locked_until: until, status: "locked" }).eq("id", data.userId);
    await writeAudit({ actorId: context.userId, action: "account_lock", targetUserId: data.userId, meta: { until, reason: data.reason ?? null } });
    await writeSecurityEvent({ userId: data.userId, kind: "account_locked", severity: "warn", meta: { until, reason: data.reason ?? null } });
    await emitNotification({ userId: data.userId, kind: "account_locked", severity: "warn",
      title: "تم قفل الحساب مؤقتًا", body: `سيُفتح تلقائيًا في ${new Date(until).toLocaleString("ar")}` });
    return { ok: true as const, until };
  });

export const unlockAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageUsers");
    const admin = await getAdmin();
    await admin.from("profiles").update({ locked_until: null, status: "active", failed_attempts: 0 }).eq("id", data.userId);
    await writeAudit({ actorId: context.userId, action: "account_unlock", targetUserId: data.userId });
    await writeSecurityEvent({ userId: data.userId, kind: "account_unlocked", severity: "info" });
    return { ok: true as const };
  });

export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { actorId?: string; targetUserId?: string; action?: string; search?: string; limit?: number }) =>
    z.object({
      actorId: z.string().uuid().optional(),
      targetUserId: z.string().uuid().optional(),
      action: z.string().max(64).optional(),
      search: z.string().max(64).optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canViewAudit");
    const admin = await getAdmin();
    let q = admin
      .from("audit_logs")
      .select("*, actor:actor_id(username, display_name), target:target_user_id(username, display_name)")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 500);
    if (data.actorId) q = q.eq("actor_id", data.actorId);
    if (data.targetUserId) q = q.eq("target_user_id", data.targetUserId);
    if (data.action) q = q.eq("action", data.action);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let filtered = rows ?? [];
    if (data.search) {
      const s = data.search.toLowerCase();
      filtered = filtered.filter((r: any) =>
        [r.action, r.ip, r.actor?.username, r.target?.username]
          .filter(Boolean).some((v: string) => v.toLowerCase().includes(s)),
      );
    }
    return filtered;
  });
