/**
 * Inbound gateway webhook processing: dedupe + idempotent handling.
 * Every `/api/public/webhooks/<provider>` route should:
 *   1. verify signature via the adapter,
 *   2. call `processInboundWebhook()` which dedupes by
 *      (provider, provider_event_id) and wraps the handler with
 *      billing-idempotency so retries never double-apply state.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PaymentProvider } from "./payments/types";
import { withIdempotency } from "./billing-idempotency.server";
import { writeBillingAudit } from "./billing-audit.server";
import { currentCorrelationId, newCorrelationId } from "./correlation.server";

export interface InboundWebhookInput {
  provider: PaymentProvider;
  providerEventId: string;
  eventType?: string;
  orgId?: string | null;
  raw: unknown;
  correlationId?: string;
}

export async function processInboundWebhook<T>(
  input: InboundWebhookInput,
  handler: (ctx: { correlationId: string }) => Promise<T>,
): Promise<{ result?: T; deduped: boolean; correlationId: string }> {
  const correlationId = input.correlationId || currentCorrelationId() || newCorrelationId("wh");

  const { data: existing } = await supabaseAdmin
    .from("gateway_webhook_events")
    .select("id, status, processed_at")
    .eq("provider", input.provider)
    .eq("provider_event_id", input.providerEventId)
    .maybeSingle();

  if (existing?.status === "processed") {
    return { deduped: true, correlationId };
  }

  if (!existing) {
    const { error } = await supabaseAdmin.from("gateway_webhook_events").insert({
      provider: input.provider,
      provider_event_id: input.providerEventId,
      event_type: input.eventType ?? null,
      org_id: input.orgId ?? null,
      correlation_id: correlationId,
      raw: (input.raw ?? {}) as never,
      status: "received",
    });
    if (error && !/duplicate|unique/i.test(error.message)) throw error;
  }

  try {
    const outcome = await withIdempotency(
      {
        orgId: input.orgId ?? "00000000-0000-0000-0000-000000000000",
        opType: "webhook.inbound",
        opKey: `${input.provider}:${input.providerEventId}`,
        correlationId,
      },
      (ctx) => handler(ctx),
    );
    await supabaseAdmin
      .from("gateway_webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("provider", input.provider)
      .eq("provider_event_id", input.providerEventId);
    if (input.orgId) {
      await writeBillingAudit({
        orgId: input.orgId,
        action: "webhook.inbound_processed",
        refType: "webhook",
        refId: null,
        meta: { provider: input.provider, providerEventId: input.providerEventId, eventType: input.eventType },
        correlationId,
      });
    }
    return { result: outcome.result, deduped: outcome.replayed, correlationId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("gateway_webhook_events")
      .update({ status: "failed" })
      .eq("provider", input.provider)
      .eq("provider_event_id", input.providerEventId);
    if (input.orgId) {
      await writeBillingAudit({
        orgId: input.orgId,
        action: "webhook.inbound_rejected",
        refType: "webhook",
        refId: null,
        meta: { provider: input.provider, providerEventId: input.providerEventId, error: msg },
        correlationId,
      });
    }
    throw e;
  }
}
