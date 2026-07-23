/**
 * Canonical billing-lifecycle audit writer. Every state change that
 * matters for revenue reconciliation — plan changes, renewals, retries,
 * grace transitions, expirations, refunds, webhook processing —
 * flows through here so a single query answers "what happened to this
 * subscription/invoice?".
 *
 * Writes two things atomically-ish:
 *   1. audit_logs — human-readable operator trail
 *   2. billing_events — machine-readable ledger for revenue jobs
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAudit } from "./audit.server";
import { currentCorrelationId } from "./correlation.server";

export type BillingAuditAction =
  | "subscription.created"
  | "subscription.plan_changed"
  | "subscription.renewed"
  | "subscription.renewal_failed"
  | "subscription.grace_started"
  | "subscription.dunning_advanced"
  | "subscription.expired"
  | "subscription.cancelled"
  | "invoice.issued"
  | "invoice.paid"
  | "invoice.voided"
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refunded"
  | "webhook.inbound_processed"
  | "webhook.inbound_rejected";

export interface BillingAuditEntry {
  orgId: string;
  action: BillingAuditAction;
  refType: "subscription" | "invoice" | "payment" | "webhook" | "order";
  refId?: string | null;
  actorId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: Record<string, unknown>;
  correlationId?: string;
}

export async function writeBillingAudit(entry: BillingAuditEntry): Promise<void> {
  const correlationId = entry.correlationId || currentCorrelationId() || null;
  try {
    await supabaseAdmin.from("billing_events").insert({
      org_id: entry.orgId,
      event_type: entry.action,
      ref_type: entry.refType,
      ref_id: entry.refId ?? null,
      payload: (entry.meta ?? {}) as never,
      actor_id: entry.actorId ?? null,
      correlation_id: correlationId,
    });
  } catch (e) {
    console.error("[billing-audit] billing_events insert failed", e);
  }
  await writeAudit({
    actorId: entry.actorId ?? null,
    action: entry.action,
    before: entry.before,
    after: entry.after,
    meta: { ...(entry.meta ?? {}), orgId: entry.orgId, refType: entry.refType, refId: entry.refId, correlationId },
  });
}
