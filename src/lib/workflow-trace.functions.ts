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
  payload?: Record<string, string | number | boolean | null | undefined> | null;
}

export const getWorkflowTrace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ correlationId: z.string().min(6), limit: z.number().int().min(1).max(500).optional() }).parse(d))
  .handler(async ({ data, context }): Promise<{ correlationId: string; count: number; steps: TraceStep[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isAdmin = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin.data) throw new Error("Forbidden");

    const limit = data.limit ?? 200;
    const cid = data.correlationId;
    const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

    const [subEvents, billEvents, audits, outbox, webhooks, intents, gwEvents] = await Promise.all([
      supabaseAdmin.from("subscription_events").select("created_at, event_type, from_state, to_state, subscription_id, payload").eq("correlation_id", cid).limit(limit),
      supabaseAdmin.from("billing_events").select("created_at, event_type, ref_type, ref_id, payload").eq("correlation_id", cid).limit(limit),
      supabaseAdmin.from("audit_logs").select("created_at, action, meta").contains("meta", { correlationId: cid } as never).limit(limit),
      supabaseAdmin.from("outbox_events").select("created_at, event_type, aggregate_type, aggregate_id, status, attempts, payload").eq("correlation_id", cid).limit(limit),
      supabaseAdmin.from("webhook_deliveries").select("created_at, event_id, endpoint_id, status, attempt, response_status").eq("correlation_id", cid).limit(limit),
      supabaseAdmin.from("payment_intents").select("created_at, provider, status, amount_cents, currency, failure_code, invoice_id").eq("correlation_id", cid).limit(limit),
      supabaseAdmin.from("gateway_webhook_events").select("received_at, provider, event_type, provider_event_id, status").eq("correlation_id", cid).limit(limit),
    ]);

    const steps: TraceStep[] = [];
    for (const r of (subEvents.data ?? []) as Array<Record<string, unknown>>) steps.push({ at: String(r.created_at), source: "subscription_events", type: String(r.event_type), refType: "subscription", refId: (r.subscription_id as string) ?? null, payload: { from: r.from_state, to: r.to_state, ...asObj(r.payload) } });
    for (const r of (billEvents.data ?? []) as Array<Record<string, unknown>>) steps.push({ at: String(r.created_at), source: "billing_events", type: String(r.event_type), refType: (r.ref_type as string) ?? null, refId: (r.ref_id as string) ?? null, payload: asObj(r.payload) });
    for (const r of (audits.data ?? []) as Array<Record<string, unknown>>) steps.push({ at: String(r.created_at), source: "audit_logs", type: String(r.action), payload: asObj(r.meta) });
    for (const r of (outbox.data ?? []) as Array<Record<string, unknown>>) steps.push({ at: String(r.created_at), source: "outbox", type: String(r.event_type), refType: (r.aggregate_type as string) ?? null, refId: (r.aggregate_id as string) ?? null, payload: { status: r.status, attempts: r.attempts, ...asObj(r.payload) } });
    for (const r of (webhooks.data ?? []) as Array<Record<string, unknown>>) steps.push({ at: String(r.created_at), source: "webhook_deliveries", type: "webhook.delivery", refId: (r.endpoint_id as string) ?? null, payload: { event_id: r.event_id, status: r.status, attempt: r.attempt, http: r.response_status } });
    for (const r of (intents.data ?? []) as Array<Record<string, unknown>>) steps.push({ at: String(r.created_at), source: "payment_intents", type: `payment.${r.status}`, refType: "invoice", refId: (r.invoice_id as string) ?? null, payload: { provider: r.provider, amount_cents: r.amount_cents, currency: r.currency, failure_code: r.failure_code } });
    for (const r of (gwEvents.data ?? []) as Array<Record<string, unknown>>) steps.push({ at: String(r.received_at), source: "gateway_webhook_events", type: `${r.provider}.${r.event_type}`, refId: (r.provider_event_id as string) ?? null, payload: { status: r.status } });

    steps.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return { correlationId: cid, count: steps.length, steps };
  });
