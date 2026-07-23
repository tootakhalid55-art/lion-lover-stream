/**
 * Bulk operations with dry-run preview.
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

const BulkAction = z.enum(["activate", "suspend", "assign_package", "revoke_devices", "force_logout"]);
type BulkAction = z.infer<typeof BulkAction>;

const bulkInput = z.object({
  action: BulkAction,
  userIds: z.array(z.string().uuid()).min(1).max(500),
  packageId: z.string().uuid().nullable().optional(),
  dryRun: z.boolean().optional(),
});

interface BulkResult {
  targetId: string;
  username?: string;
  ok: boolean;
  change?: any;
  error?: string;
}

export const bulkPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => bulkInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canBulk");
    const admin = await getAdmin();
    const { data: users } = await admin
      .from("profiles")
      .select("id, username, status, package_id, expires_at")
      .in("id", data.userIds);
    let pkg: any = null;
    if (data.action === "assign_package" && data.packageId) {
      const { data: p } = await admin.from("packages").select("*").eq("id", data.packageId).maybeSingle();
      pkg = p;
      if (!pkg) throw new Error("Package not found");
    }
    const results: BulkResult[] = (users ?? []).map((u: any) => {
      switch (data.action) {
        case "activate":
          return { targetId: u.id, username: u.username, ok: true, change: { status: { from: u.status, to: "active" } } };
        case "suspend":
          return { targetId: u.id, username: u.username, ok: true, change: { status: { from: u.status, to: "suspended" } } };
        case "assign_package": {
          const expires = pkg.tier === "lifetime" ? null
            : pkg.duration_days ? new Date(Date.now() + pkg.duration_days * 86400_000).toISOString() : null;
          return { targetId: u.id, username: u.username, ok: true, change: {
            package_id: { from: u.package_id, to: pkg.id, name: pkg.name },
            expires_at: { from: u.expires_at, to: expires },
          } };
        }
        case "revoke_devices":
          return { targetId: u.id, username: u.username, ok: true, change: { devices: "revoke_all" } };
        case "force_logout":
          return { targetId: u.id, username: u.username, ok: true, change: { sessions: "revoke_all" } };
      }
    });
    return { results, count: results.length, pkg };
  });

export const bulkExecute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => bulkInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canBulk");
    const admin = await getAdmin();
    const results: BulkResult[] = [];
    let pkg: any = null;
    if (data.action === "assign_package") {
      if (!data.packageId) throw new Error("packageId required");
      const { data: p } = await admin.from("packages").select("*").eq("id", data.packageId).maybeSingle();
      pkg = p;
      if (!pkg) throw new Error("Package not found");
    }
    for (const id of data.userIds) {
      try {
        if (data.action === "activate") {
          await admin.from("profiles").update({ status: "active" }).eq("id", id);
        } else if (data.action === "suspend") {
          await admin.from("profiles").update({ status: "suspended" }).eq("id", id);
        } else if (data.action === "assign_package") {
          const expires = pkg.tier === "lifetime" ? null
            : pkg.duration_days ? new Date(Date.now() + pkg.duration_days * 86400_000).toISOString() : null;
          await admin.from("profiles").update({ package_id: pkg.id, expires_at: expires, status: "active" }).eq("id", id);
        } else if (data.action === "revoke_devices") {
          const now = new Date().toISOString();
          await admin.from("user_devices").update({ blocked_at: now }).eq("user_id", id).is("blocked_at", null);
          await admin.from("user_sessions")
            .update({ revoked_at: now, revoked_by: context.userId, revoked_reason: "bulk_revoke_devices" })
            .eq("user_id", id).is("revoked_at", null);
        } else if (data.action === "force_logout") {
          const now = new Date().toISOString();
          await admin.from("user_sessions")
            .update({ revoked_at: now, revoked_by: context.userId, revoked_reason: "bulk_force_logout" })
            .eq("user_id", id).is("revoked_at", null);
          await admin.auth.admin.signOut(id).catch(() => {});
        }
        await writeAudit({ actorId: context.userId, action: `bulk_${data.action}`, targetUserId: id, meta: { packageId: data.packageId ?? null } });
        results.push({ targetId: id, ok: true });
      } catch (e: any) {
        results.push({ targetId: id, ok: false, error: String(e?.message ?? e) });
      }
    }
    await writeSecurityEvent({ userId: null, kind: "bulk_op", severity: "info",
      meta: { action: data.action, count: results.length, actor: context.userId } });
    return { results, count: results.length };
  });
