/**
 * End-to-end subscription-renewal workflow. Orchestrates:
 *   advisory lock → idempotency key → invoice issue → payment attempt →
 *   audit + billing events → outbox webhook → state transition.
 *
 * The workflow is resumable: if any step throws, the idempotency row
 * captures the failure and a subsequent call replays cleanly — the
 * invoice will already exist (via billing_idempotency), the payment
 * attempt is re-issued, and downstream events are re-enqueued to the
 * outbox (webhook dispatcher dedupes by event_id).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withAdvisoryLock } from "./advisory-lock.server";
import { withIdempotency } from "./billing-idempotency.server";
import { currentCorrelationId, newCorrelationId, runWithCorrelation } from "./correlation.server";
import { writeBillingAudit } from "./billing-audit.server";
import { enqueueOutbox } from "./outbox.server";
import { normalizeFailure, type NormalizedFailure } from "./failure-reasons.server";
import { advanceDunning } from "./dunning-engine.server";
import { renewSubscription as coreRenew, markPaymentFailed as coreMarkFailed } from "./subscriptions.server";
import { getAdapter } from "./payments/adapter.server";
import { issueInvoice } from "./billing.server";
import type { PaymentProvider, PaymentMode } from "./payments/types";

export interface RenewalContext {
  subscriptionId: string;
  correlationId?: string;
  actorId?: string | null;
  mode?: PaymentMode;
}

export interface RenewalOutcome {
  status: "renewed" | "payment_failed" | "skipped";
  correlationId: string;
  invoiceId?: string;
  paymentId?: string;
  failure?: NormalizedFailure;
  skippedReason?: string;
}

interface SubRow {
  id: string;
  org_id: string;
  status: string;
  plan_id: string;
  quantity: number;
  payment_method_id: string | null;
  collection_method: string;
}

interface PlanRow {
  id: string;
  price_cents: number;
  currency: string;
  interval: string;
}

interface PaymentMethodRow {
  id: string;
  provider: PaymentProvider;
  provider_ref: string | null;
  meta: Record<string, unknown> | null;
}

async function loadSub(id: string): Promise<SubRow> {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, org_id, status, plan_id, quantity, payment_method_id, collection_method")
    .eq("id", id).single();
  if (error) throw error;
  return data as SubRow;
}

async function loadPlan(id: string): Promise<PlanRow> {
  const { data, error } = await supabaseAdmin
    .from("billing_plans").select("id, price_cents, currency, interval").eq("id", id).single();
  if (error) throw error;
  return data as PlanRow;
}

async function loadPaymentMethod(id: string | null): Promise<PaymentMethodRow | null> {
  if (!id) return null;
  const { data } = await supabaseAdmin
    .from("payment_methods").select("id, provider, provider_ref, meta").eq("id", id).maybeSingle();
  return (data ?? null) as PaymentMethodRow | null;
}

/**
 * Kick off a subscription renewal. Safe to call concurrently and repeatedly
 * — dedup is enforced by the advisory lock and billing_idempotency row.
 */
export async function runRenewal(ctx: RenewalContext): Promise<RenewalOutcome> {
  const cid = ctx.correlationId ?? currentCorrelationId() ?? newCorrelationId();
  return runWithCorrelation(cid, async () => {
    const lock = await withAdvisoryLock("subscription.renew", ctx.subscriptionId, async () => {
      return await withIdempotency<RenewalOutcome>(
        {
          orgId: (await loadSub(ctx.subscriptionId)).org_id,
          opType: "subscription.renew",
          opKey: `${ctx.subscriptionId}:${new Date().toISOString().slice(0, 10)}`,
          correlationId: cid,
        },
        async ({ correlationId }) => executeRenewal(ctx, correlationId),
      ).then((r) => r.result);
    });
    if (!lock.acquired) {
      return { status: "skipped", correlationId: cid, skippedReason: lock.skippedReason };
    }
    return lock.result!;
  });
}

async function executeRenewal(ctx: RenewalContext, cid: string): Promise<RenewalOutcome> {
  const sub = await loadSub(ctx.subscriptionId);
  const plan = await loadPlan(sub.plan_id);
  const amountCents = plan.price_cents * (sub.quantity || 1);

  await enqueueOutbox({
    aggregateType: "subscription", aggregateId: sub.id,
    eventType: "SubscriptionRenewalStarted",
    payload: { subscriptionId: sub.id, orgId: sub.org_id, amountCents, currency: plan.currency },
    correlationId: cid,
  });

  // 1. Issue invoice (idempotent by construction: unique doc number + snapshot).
  const invoice = await issueInvoice({
    orgId: sub.org_id,
    docType: "invoice",
    currency: plan.currency,
    branch: "MAIN",
    sourceType: "subscription",
    sourceId: sub.id,
    lines: [{
      description: `Subscription renewal (${plan.interval})`,
      qty: sub.quantity || 1,
      unitPriceCents: plan.price_cents,
      kind: "subscription",
      ref: { subscriptionId: sub.id, planId: plan.id },
    }],
    meta: { subscription_id: sub.id, correlation_id: cid },
    actorId: ctx.actorId ?? null,
  } as never);

  // 2. Attempt payment if a saved method exists AND collection_method is automatic.
  if (sub.collection_method !== "charge_automatically" || !sub.payment_method_id) {
    await writeBillingAudit({
      orgId: sub.org_id, action: "invoice.issued", refType: "invoice", refId: invoice.invoiceId,
      correlationId: cid, meta: { subscriptionId: sub.id, collection: "send_invoice" },
    });
    await coreRenew(sub.id, cid);
    return { status: "renewed", correlationId: cid, invoiceId: invoice.invoiceId };
  }

  const pm = await loadPaymentMethod(sub.payment_method_id);
  if (!pm) {
    const failure: NormalizedFailure = { reason: "invalid_request", retryable: false, permanent: true, message: "payment_method_missing" };
    await handleFailure(sub, invoice.invoiceId, failure, cid);
    return { status: "payment_failed", correlationId: cid, invoiceId: invoice.invoiceId, failure };
  }

  const adapter = getAdapter(pm.provider);
  const mode: PaymentMode = ctx.mode ?? "live";
  try {
    const charge = await adapter.charge(
      { orgId: sub.org_id, mode, config: (pm.meta ?? {}) as Record<string, unknown>, correlationId: cid },
      { orgId: sub.org_id, amountCents, currency: plan.currency, idempotencyKey: `sub:${sub.id}:${invoice.invoiceId}`, paymentMethodRef: pm.provider_ref ?? undefined, invoiceId: invoice.invoiceId },
    );

    if (charge.status === "succeeded") {
      await handleSuccess(sub, invoice.invoiceId, charge, cid, plan.currency, amountCents, pm.provider);
      return { status: "renewed", correlationId: cid, invoiceId: invoice.invoiceId, paymentId: charge.providerRef };
    }
    const failure: NormalizedFailure = charge.status === "failed"
      ? { reason: "card_declined", retryable: true, permanent: false, message: charge.failureMessage ?? "declined", providerCode: charge.failureCode }
      : { reason: "authentication_required", retryable: false, permanent: false, message: `pending:${charge.status}` };
    await handleFailure(sub, invoice.invoiceId, failure, cid);
    return { status: "payment_failed", correlationId: cid, invoiceId: invoice.invoiceId, failure };
  } catch (e) {
    const failure = normalizeFailure(e);
    await handleFailure(sub, invoice.invoiceId, failure, cid);
    return { status: "payment_failed", correlationId: cid, invoiceId: invoice.invoiceId, failure };
  }
}

async function handleSuccess(
  sub: SubRow, invoiceId: string, charge: { providerRef?: string; providerRefId?: string }, cid: string,
  currency: string, amountCents: number, provider: PaymentProvider,
) {
  const { markInvoicePaid } = await import("./billing.server");
  const providerRef = charge.providerRef ?? (charge as unknown as { providerRefId?: string }).providerRefId ?? null;
  await markInvoicePaid({
    invoiceId, amountCents,
    gateway: provider === "moyasar" || provider === "hyperpay" || provider === "paytabs" || provider === "stripe" ? provider : "manual",
    gatewayRef: providerRef, actorId: null,
  });
  await coreRenew(sub.id, cid);
  await writeBillingAudit({
    orgId: sub.org_id, action: "payment.succeeded", refType: "payment", refId: providerRef,
    correlationId: cid, meta: { subscriptionId: sub.id, invoiceId, amountCents, currency },
  });
  await enqueueOutbox({
    aggregateType: "subscription", aggregateId: sub.id, eventType: "PaymentCaptured",
    payload: { subscriptionId: sub.id, orgId: sub.org_id, invoiceId, amountCents, currency, provider }, correlationId: cid,
  });
  await enqueueOutbox({
    aggregateType: "subscription", aggregateId: sub.id, eventType: "SubscriptionRenewed",
    payload: { subscriptionId: sub.id, orgId: sub.org_id, invoiceId }, correlationId: cid,
  });
}

async function handleFailure(sub: SubRow, invoiceId: string, failure: NormalizedFailure, cid: string) {
  await coreMarkFailed(sub.id, cid);
  await writeBillingAudit({
    orgId: sub.org_id, action: "payment.failed", refType: "payment", refId: null,
    correlationId: cid, meta: { subscriptionId: sub.id, invoiceId, ...failure },
  });
  await enqueueOutbox({
    aggregateType: "subscription", aggregateId: sub.id, eventType: "PaymentFailed",
    payload: { subscriptionId: sub.id, orgId: sub.org_id, invoiceId, ...failure }, correlationId: cid,
  });
  await enqueueOutbox({
    aggregateType: "subscription", aggregateId: sub.id, eventType: "RenewalFailed",
    payload: { subscriptionId: sub.id, orgId: sub.org_id, invoiceId, reason: failure.reason }, correlationId: cid,
  });
  // Immediately step dunning for retryable failures so the customer gets a reminder;
  // permanent failures still enter dunning at stage 0 (which is typically a reminder).
  if (failure.retryable || !failure.permanent) {
    await advanceDunning(sub.id, cid);
  }
}
