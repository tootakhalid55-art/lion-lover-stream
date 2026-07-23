/**
 * Central audit + security-event writer. Every mutating admin server fn
 * routes through `writeAudit` so the /admin/audit trail stays complete.
 */
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

export function clientIp(): string {
  return (
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-real-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    getRequestIP({ xForwardedFor: true }) ||
    "unknown"
  );
}
export function clientUA(): string {
  return getRequestHeader("user-agent") || "unknown";
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface AuditEntry {
  actorId: string | null;
  action: string;
  targetUserId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: Record<string, unknown>;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = await getAdmin();
    await admin.from("audit_logs").insert({
      actor_id: entry.actorId,
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      before_value: (entry.before as any) ?? null,
      after_value: (entry.after as any) ?? null,
      meta: (entry.meta as any) ?? {},
      ip: clientIp(),
      user_agent: clientUA(),
    });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}

export type SecurityKind =
  | "failed_login"
  | "successful_login"
  | "password_change"
  | "package_activated"
  | "license_activated"
  | "device_registered"
  | "new_device"
  | "device_revoked"
  | "session_revoked"
  | "suspicious"
  | "account_locked"
  | "account_unlocked"
  | "bulk_op"
  | "job_failed";

export interface SecurityEventEntry {
  userId?: string | null;
  kind: SecurityKind;
  severity?: "info" | "warn" | "critical";
  meta?: Record<string, unknown>;
  country?: string | null;
}

export async function writeSecurityEvent(entry: SecurityEventEntry): Promise<void> {
  try {
    const admin = await getAdmin();
    await admin.from("security_events").insert({
      user_id: entry.userId ?? null,
      kind: entry.kind,
      severity: entry.severity ?? "info",
      ip: clientIp(),
      user_agent: clientUA(),
      country: entry.country ?? null,
      meta: (entry.meta as any) ?? {},
    });
  } catch (e) {
    console.error("[security-event] failed", e);
  }
}

export interface NotificationEntry {
  userId?: string | null; // null = broadcast to all admins
  kind: string;
  title: string;
  body?: string;
  severity?: "info" | "warn" | "critical";
  meta?: Record<string, unknown>;
}

export async function emitNotification(entry: NotificationEntry): Promise<void> {
  try {
    const admin = await getAdmin();
    await admin.from("notifications").insert({
      user_id: entry.userId ?? null,
      kind: entry.kind,
      title: entry.title,
      body: entry.body ?? null,
      severity: entry.severity ?? "info",
      meta: (entry.meta as any) ?? {},
    });
  } catch (e) {
    console.error("[notification] failed", e);
  }
}
