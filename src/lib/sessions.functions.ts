/**
 * Session management server functions.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability } from "@/lib/rbac.server";
import { writeAudit, writeSecurityEvent } from "@/lib/audit.server";
import { z } from "zod";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { userId?: string; state?: "active" | "expired" | "all"; search?: string }) =>
    z.object({
      userId: z.string().uuid().optional(),
      state: z.enum(["active", "expired", "all"]).optional(),
      search: z.string().max(64).optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canViewSecurity");
    const admin = await getAdmin();
    let q = admin
      .from("user_sessions")
      .select("*, profiles:user_id(username, display_name)")
      .order("last_seen", { ascending: false })
      .limit(500);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.state === "active") q = q.is("revoked_at", null);
    if (data.state === "expired") q = q.not("revoked_at", "is", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let filtered = rows ?? [];
    if (data.search) {
      const s = data.search.toLowerCase();
      filtered = filtered.filter((r: any) =>
        [r.ip, r.user_agent, r.country, r.profiles?.username]
          .filter(Boolean).some((v: string) => v.toLowerCase().includes(s)),
      );
    }
    return filtered;
  });

export const terminateSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; reason?: string }) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(200).optional() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageSessions");
    const admin = await getAdmin();
    const before = await admin.from("user_sessions").select("*").eq("id", data.id).maybeSingle();
    if (!before.data) throw new Error("Session not found");
    if (before.data.revoked_at) return { ok: true as const, alreadyRevoked: true };
    const now = new Date().toISOString();
    await admin.from("user_sessions")
      .update({ revoked_at: now, revoked_by: context.userId, revoked_reason: data.reason || "manual" })
      .eq("id", data.id);
    await writeAudit({
      actorId: context.userId, action: "session_terminate",
      targetUserId: before.data.user_id, meta: { session_id: data.id, reason: data.reason ?? null },
    });
    await writeSecurityEvent({ userId: before.data.user_id, kind: "session_revoked", severity: "info", meta: { reason: data.reason ?? "manual" } });
    return { ok: true as const };
  });

export const terminateOtherSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { userId: string; keepSessionId?: string }) =>
    z.object({ userId: z.string().uuid(), keepSessionId: z.string().uuid().optional() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageSessions");
    const admin = await getAdmin();
    const now = new Date().toISOString();
    let q = admin.from("user_sessions")
      .update({ revoked_at: now, revoked_by: context.userId, revoked_reason: "terminate_others" })
      .eq("user_id", data.userId).is("revoked_at", null);
    if (data.keepSessionId) q = q.neq("id", data.keepSessionId);
    const { error, count } = await q.select("id", { count: "exact" });
    if (error) throw new Error(error.message);
    await writeAudit({
      actorId: context.userId, action: "session_terminate_others",
      targetUserId: data.userId, meta: { count: count ?? 0, kept: data.keepSessionId ?? null },
    });
    return { ok: true as const, count: count ?? 0 };
  });

export const forceReauth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageSessions");
    const admin = await getAdmin();
    const now = new Date().toISOString();
    await admin.from("profiles").update({ reauth_after: now }).eq("id", data.userId);
    await admin.from("user_sessions")
      .update({ revoked_at: now, revoked_by: context.userId, revoked_reason: "force_reauth" })
      .eq("user_id", data.userId).is("revoked_at", null);
    await admin.auth.admin.signOut(data.userId).catch(() => {});
    await writeAudit({ actorId: context.userId, action: "force_reauth", targetUserId: data.userId, after: { reauth_after: now } });
    await writeSecurityEvent({ userId: data.userId, kind: "session_revoked", severity: "warn", meta: { reason: "force_reauth" } });
    return { ok: true as const };
  });
