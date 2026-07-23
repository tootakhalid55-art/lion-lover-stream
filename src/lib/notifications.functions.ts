/**
 * Notifications: user inbox + admin broadcast.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability } from "@/lib/rbac.server";
import { writeAudit } from "@/lib/audit.server";
import { z } from "zod";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    const { data, error } = await admin
      .from("notifications")
      .select("*")
      .or(`user_id.eq.${context.userId},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    await admin.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .or(`user_id.eq.${context.userId},user_id.is.null`);
    return { ok: true as const };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    await admin.from("notifications").update({ read_at: new Date().toISOString() })
      .is("read_at", null)
      .or(`user_id.eq.${context.userId},user_id.is.null`);
    return { ok: true as const };
  });

export const broadcastNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { title: string; body?: string; severity?: "info" | "warn" | "critical" }) =>
    z.object({
      title: z.string().min(1).max(200),
      body: z.string().max(2000).optional(),
      severity: z.enum(["info", "warn", "critical"]).optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canBroadcast");
    const admin = await getAdmin();
    await admin.from("notifications").insert({
      user_id: null, kind: "broadcast",
      title: data.title, body: data.body ?? null, severity: data.severity ?? "info",
    });
    await writeAudit({ actorId: context.userId, action: "notification_broadcast", meta: { title: data.title } });
    return { ok: true as const };
  });
