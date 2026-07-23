/**
 * Workflow Trace — assemble a full timeline for a correlation ID across
 * every table that carries `correlation_id`: subscription_events,
 * billing_events, audit_logs, outbox_events, webhook_deliveries,
 * payment_intents, and gateway_webhook_events. This is the operator's
 * one-stop diagnosis view for "what happened to this renewal?".
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface TraceStep {
  at: string;
  source: string;
  type: string;
  refType?: string | null;
  refId?: string | null;
  payload?: unknown;
}

export const getWorkflowTrace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ correlationId: z.string().min(6), limit: z.number().int().min(1).max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isAdmin = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin.data) throw new Error("Forbidden");

    const limit = data.limit ?? 200;
    const cid = data.correlationId;

    const [subEvents, billEvents, audits, outbox, webhooks, intents, gwEvents] = await Promise.all([
      supabaseAdmin.from("subscription_events").select("created_at, event_type, from_state, to_state, subscription_id, payload").eq("correlation_id", cid).limit(limit),
      supabaseAdmin.from("billing_events").select("created_at, event_type, ref_type, ref_id, payload").eq("correlation_id", cid).limit(limit),
      supabaseAdmin.from("audit_logs").select("created_at, action, meta").contains("meta", { correlationId: cid } as never).limit(limit),
      supabaseAdmin.from("outbox_events").select("created_at, event_type, aggregate_type, aggregate_id, status, attempts, payload").eq("correlation_id", cid).limit(limit),
      supabaseAdmin.from("webhook_deliveries").select("created_at, event_type, endpoint_id, status, attempts, response_status").eq("correlation_id", cid).limit(limit),
      supabaseAdmin.from("payment_intents").select("created_at, provider, status, amount_cents, currency, failure_code, invoice_id").eq("correlation_id", cid).limit(limit),
      supabaseAdmin.from("gateway_webhook_events").select("received_at, provider, event_type, gateway_event_id, dedup_status").eq("correlation_id", cid).limit(limit),
    ]);

    const steps: TraceStep[] = [];
    for (const r of subEvents.data ?? []) steps.push({ at: r.created_at, source: "subscription_events", type: r.event_type, refType: "subscription", refId: r.subscription_id, payload: { from: r.from_state, to: r.to_state, ...(r.payload as object || {}) } });
    for (const r of billEvents.data ?? []) steps.push({ at: r.created_at, source: "billing_events", type: r.event_type, refType: r.ref_type, refId: r.ref_id, payload: r.payload });
    for (const r of audits.data ?? []) steps.push({ at: r.created_at, source: "audit_logs", type: r.action, payload: r.meta });
    for (const r of outbox.data ?? []) steps.push({ at: r.created_at, source: "outbox", type: r.event_type, refType: r.aggregate_type, refId: r.aggregate_id, payload: { status: r.status, attempts: r.attempts, ...(r.payload as object || {}) } });
    for (const r of webhooks.data ?? []) steps.push({ at: r.created_at, source: "webhook_deliveries", type: r.event_type, refId: r.endpoint_id, payload: { status: r.status, attempts: r.attempts, http: r.response_status } });
    for (const r of intents.data ?? []) steps.push({ at: r.created_at, source: "payment_intents", type: `payment.${r.status}`, refType: "invoice", refId: r.invoice_id, payload: { provider: r.provider, amount_cents: r.amount_cents, currency: r.currency, failure_code: r.failure_code } });
    for (const r of gwEvents.data ?? []) steps.push({ at: (r as any).received_at, source: "gateway_webhook_events", type: `${r.provider}.${r.event_type}`, refId: r.gateway_event_id, payload: { dedup: r.dedup_status } });

    steps.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return { correlationId: cid, count: steps.length, steps };
  });
