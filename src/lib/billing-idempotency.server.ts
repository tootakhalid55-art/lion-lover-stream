/**
 * Internal-operation idempotency. Wrap every payment charge, refund,
 * renewal, dunning-step, and inbound-webhook handler with `withIdempotency()`
 * so retries never double-charge, double-renew, or double-post.
 *
 * Contract: (orgId, opType, opKey) is unique. First caller inserts an
 * `in_flight` row, executes fn(), then stores the result. Subsequent
 * callers for the same tuple replay the stored result (or wait for the
 * in-flight to complete on next call).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { currentCorrelationId, newCorrelationId } from "./correlation.server";

export type BillingOpType =
  | "payment.charge"
  | "payment.refund"
  | "subscription.renew"
  | "subscription.dunning_step"
  | "invoice.issue"
  | "webhook.inbound";

export interface IdempotencyOpts {
  orgId: string;
  opType: BillingOpType;
  opKey: string;
  correlationId?: string;
}

export interface IdempotencyOutcome<T> {
  result: T;
  replayed: boolean;
  correlationId: string;
}

export async function withIdempotency<T>(
  opts: IdempotencyOpts,
  fn: (ctx: { correlationId: string }) => Promise<T>,
): Promise<IdempotencyOutcome<T>> {
  const correlationId = opts.correlationId || currentCorrelationId() || newCorrelationId();

  const { data: existing } = await supabaseAdmin
    .from("billing_idempotency")
    .select("id, status, result, attempts")
    .eq("org_id", opts.orgId)
    .eq("op_type", opts.opType)
    .eq("op_key", opts.opKey)
    .maybeSingle();

  if (existing?.status === "succeeded" && existing.result !== null) {
    return { result: existing.result as T, replayed: true, correlationId };
  }

  if (!existing) {
    const { error: insErr } = await supabaseAdmin.from("billing_idempotency").insert({
      org_id: opts.orgId,
      op_type: opts.opType,
      op_key: opts.opKey,
      correlation_id: correlationId,
      status: "in_flight",
    });
    if (insErr && !/duplicate|unique/i.test(insErr.message)) throw insErr;
  } else {
    await supabaseAdmin
      .from("billing_idempotency")
      .update({ status: "in_flight", attempts: (existing.attempts ?? 0) + 1, correlation_id: correlationId })
      .eq("id", existing.id);
  }

  try {
    const result = await fn({ correlationId });
    await supabaseAdmin
      .from("billing_idempotency")
      .update({
        status: "succeeded",
        result: (result ?? null) as never,
        completed_at: new Date().toISOString(),
      })
      .eq("org_id", opts.orgId)
      .eq("op_type", opts.opType)
      .eq("op_key", opts.opKey);
    return { result, replayed: false, correlationId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("billing_idempotency")
      .update({ status: "failed", error: msg, completed_at: new Date().toISOString() })
      .eq("org_id", opts.orgId)
      .eq("op_type", opts.opType)
      .eq("op_key", opts.opKey);
    throw e;
  }
}
