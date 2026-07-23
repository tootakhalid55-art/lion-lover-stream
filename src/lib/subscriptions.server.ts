// Subscription lifecycle engine.
// States: trialing | active | past_due | grace | suspended | cancelled | expired
// Operations: create, changePlan (upgrade/downgrade with proration),
// renew, cancel, resume, advanceDunning.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enqueueOutbox } from "./outbox.server";

export type SubscriptionState =
  | "trialing"
  | "active"
  | "past_due"
  | "grace"
  | "suspended"
  | "cancelled"
  | "expired";

interface PlanRow {
  id: string;
  interval: string;
  price_cents: number;
  currency: string;
  trial_days: number | null;
}

async function getPlan(planId: string): Promise<PlanRow> {
  const { data, error } = await supabaseAdmin
    .from("billing_plans")
    .select("id, interval, price_cents, currency, trial_days")
    .eq("id", planId)
    .single();
  if (error) throw error;
  return data as PlanRow;
}

function addInterval(from: Date, interval: string): Date {
  const d = new Date(from);
  switch (interval) {
    case "day": d.setUTCDate(d.getUTCDate() + 1); break;
    case "week": d.setUTCDate(d.getUTCDate() + 7); break;
    case "month": d.setUTCMonth(d.getUTCMonth() + 1); break;
    case "quarter": d.setUTCMonth(d.getUTCMonth() + 3); break;
    case "year": d.setUTCFullYear(d.getUTCFullYear() + 1); break;
    default: throw new Error(`Unsupported interval: ${interval}`);
  }
  return d;
}

async function logEvent(sub: {
  id: string; org_id: string;
}, evt: { type: string; from?: string; to?: string; payload?: Record<string, unknown>; correlationId?: string; actorId?: string | null }) {
  await supabaseAdmin.from("subscription_events").insert({
    subscription_id: sub.id,
    org_id: sub.org_id,
    event_type: evt.type,
    from_state: evt.from ?? null,
    to_state: evt.to ?? null,
    payload: (evt.payload ?? {}) as never,
    correlation_id: evt.correlationId ?? null,
    actor_id: evt.actorId ?? null,
  });
  await enqueueOutbox({
    aggregateType: "subscription",
    aggregateId: sub.id,
    eventType: `subscription.${evt.type}`,
    payload: { subscriptionId: sub.id, orgId: sub.org_id, from: evt.from, to: evt.to, ...(evt.payload ?? {}) },
    correlationId: evt.correlationId,
  });
}

export interface CreateSubscriptionInput {
  orgId: string;
  planId: string;
  quantity?: number;
  paymentMethodId?: string;
  trialOverrideDays?: number;
  collectionMethod?: "charge_automatically" | "send_invoice";
  actorId?: string | null;
  correlationId?: string;
}

export async function createSubscription(input: CreateSubscriptionInput) {
  const plan = await getPlan(input.planId);
  const now = new Date();
  const trialDays = input.trialOverrideDays ?? plan.trial_days ?? 0;
  const trialEnds = trialDays > 0 ? new Date(now.getTime() + trialDays * 86400_000) : null;
  const periodStart = now;
  const periodEnd = addInterval(trialEnds ?? now, plan.interval);
  const status: SubscriptionState = trialEnds ? "trialing" : "active";

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      org_id: input.orgId,
      plan_id: input.planId,
      status,
      quantity: input.quantity ?? 1,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      trial_ends_at: trialEnds?.toISOString() ?? null,
      next_billing_at: periodEnd.toISOString(),
      payment_method_id: input.paymentMethodId ?? null,
      collection_method: input.collectionMethod ?? "charge_automatically",
      meta: {},
    })
    .select("id, org_id, status")
    .single();
  if (error) throw error;
  await logEvent(data, { type: "created", to: status, payload: { planId: input.planId }, correlationId: input.correlationId, actorId: input.actorId });
  return data;
}

export interface ChangePlanInput {
  subscriptionId: string;
  newPlanId: string;
  proration?: boolean;
  actorId?: string | null;
  correlationId?: string;
}

/**
 * Change subscription plan with linear proration. Returns proration credit/debit
 * in the currency of the current subscription.
 */
export async function changePlan(input: ChangePlanInput) {
  const { data: sub, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, org_id, status, plan_id, current_period_start, current_period_end, quantity")
    .eq("id", input.subscriptionId)
    .single();
  if (error) throw error;
  const [oldPlan, newPlan] = await Promise.all([getPlan(sub.plan_id), getPlan(input.newPlanId)]);

  let prorationCents = 0;
  if (input.proration !== false && sub.current_period_end) {
    const now = Date.now();
    const start = new Date(sub.current_period_start).getTime();
    const end = new Date(sub.current_period_end).getTime();
    const total = Math.max(end - start, 1);
    const remaining = Math.max(end - now, 0);
    const remainingRatio = remaining / total;
    const unusedOld = Math.round(oldPlan.price_cents * sub.quantity * remainingRatio);
    const unusedNew = Math.round(newPlan.price_cents * sub.quantity * remainingRatio);
    prorationCents = unusedNew - unusedOld;
  }

  const { error: updErr } = await supabaseAdmin
    .from("subscriptions")
    .update({ plan_id: input.newPlanId })
    .eq("id", sub.id);
  if (updErr) throw updErr;

  await logEvent(sub, {
    type: "plan_changed",
    payload: { fromPlan: sub.plan_id, toPlan: input.newPlanId, prorationCents, currency: oldPlan.currency },
    correlationId: input.correlationId,
    actorId: input.actorId,
  });
  return { subscriptionId: sub.id, prorationCents, currency: oldPlan.currency };
}

export async function renewSubscription(subscriptionId: string, correlationId?: string) {
  const { data: sub, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, org_id, status, plan_id, current_period_end")
    .eq("id", subscriptionId)
    .single();
  if (error) throw error;
  const plan = await getPlan(sub.plan_id);
  const anchor = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
  const newStart = anchor;
  const newEnd = addInterval(anchor, plan.interval);
  await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: newStart.toISOString(),
      current_period_end: newEnd.toISOString(),
      next_billing_at: newEnd.toISOString(),
      last_billing_at: new Date().toISOString(),
      dunning_stage: 0,
      grace_period_ends_at: null,
    })
    .eq("id", sub.id);
  await logEvent(sub, { type: "renewed", from: sub.status, to: "active", correlationId });
  return { subscriptionId, newPeriodEnd: newEnd.toISOString() };
}

export async function cancelSubscription(opts: { subscriptionId: string; atPeriodEnd?: boolean; actorId?: string | null; correlationId?: string }) {
  const { data: sub, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, org_id, status, current_period_end")
    .eq("id", opts.subscriptionId)
    .single();
  if (error) throw error;
  const atEnd = opts.atPeriodEnd !== false;
  const updates: Record<string, unknown> = atEnd
    ? { cancel_at: sub.current_period_end, canceled_at: new Date().toISOString() }
    : { status: "cancelled", cancel_at: new Date().toISOString(), canceled_at: new Date().toISOString() };
  await supabaseAdmin.from("subscriptions").update(updates as never).eq("id", sub.id);
  await logEvent(sub, {
    type: atEnd ? "cancel_scheduled" : "cancelled",
    from: sub.status,
    to: atEnd ? sub.status : "cancelled",
    correlationId: opts.correlationId,
    actorId: opts.actorId,
  });
}

export async function markPaymentFailed(subscriptionId: string, correlationId?: string) {
  const { data: sub, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, org_id, status, dunning_stage, dunning_policy_id")
    .eq("id", subscriptionId)
    .single();
  if (error) throw error;
  const { data: policy } = sub.dunning_policy_id
    ? await supabaseAdmin.from("dunning_policies").select("grace_days").eq("id", sub.dunning_policy_id).maybeSingle()
    : { data: null };
  const graceDays = policy?.grace_days ?? 3;
  const grace = new Date(Date.now() + graceDays * 86400_000);
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "past_due", grace_period_ends_at: grace.toISOString() })
    .eq("id", sub.id);
  await logEvent(sub, { type: "payment_failed", from: sub.status, to: "past_due", correlationId });
}

export async function expireIfBeyondGrace(subscriptionId: string) {
  const { data: sub, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, org_id, status, grace_period_ends_at")
    .eq("id", subscriptionId)
    .single();
  if (error) throw error;
  if (sub.status !== "past_due" && sub.status !== "grace") return;
  if (!sub.grace_period_ends_at) return;
  if (new Date(sub.grace_period_ends_at).getTime() > Date.now()) return;
  await supabaseAdmin.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
  await logEvent(sub, { type: "expired", from: sub.status, to: "expired" });
}
