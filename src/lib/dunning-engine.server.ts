/**
 * Config-driven dunning stepper. Every timing, channel, template, and
 * escalation action is loaded from `dunning_policies` +
 * `dunning_policy_stages`. Zero hard-coded schedules in code.
 *
 * A "run" is one advance of a single subscription's dunning cursor. The
 * scheduler (jobs-registry) picks candidates by
 * (status in past_due/grace, next dunning due <= now) and hands each to
 * `advanceDunning()`; the stepper decides what stage runs next, fires the
 * notification, optionally retries payment, and escalates on the final
 * stage.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withAdvisoryLock } from "./advisory-lock.server";
import { withIdempotency } from "./billing-idempotency.server";
import { writeBillingAudit } from "./billing-audit.server";
import { enqueueOutbox } from "./outbox.server";
import { currentCorrelationId, newCorrelationId, runWithCorrelation } from "./correlation.server";

export type DunningAction =
  | "friendly_reminder"
  | "second_reminder"
  | "final_reminder"
  | "retry_payment"
  | "suspend"
  | "terminate";

interface Stage {
  id: string;
  policy_id: string;
  stage_index: number;
  offset_days: number;
  action: DunningAction;
  channels: string[];
  template_code: string | null;
}

async function loadStages(policyId: string): Promise<Stage[]> {
  const { data, error } = await supabaseAdmin
    .from("dunning_policy_stages")
    .select("id, policy_id, stage_index, offset_days, action, channels, template_code")
    .eq("policy_id", policyId)
    .order("stage_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Stage[];
}

export interface AdvanceResult {
  advanced: boolean;
  stageIndex?: number;
  action?: DunningAction;
  escalated?: "suspended" | "terminated";
  skippedReason?: string;
}

/**
 * Advance one subscription's dunning cursor by one stage. Safe to call
 * many times concurrently — advisory lock + idempotency key guarantee at
 * most one execution per (subscription, current stage).
 */
export async function advanceDunning(subscriptionId: string, correlationId?: string): Promise<AdvanceResult> {
  const cid = correlationId ?? currentCorrelationId() ?? newCorrelationId();
  return runWithCorrelation(cid, async () => {
    const lock = await withAdvisoryLock("dunning", subscriptionId, async () => {
      const { data: sub, error } = await supabaseAdmin
        .from("subscriptions")
        .select("id, org_id, status, dunning_stage, dunning_policy_id, grace_period_ends_at")
        .eq("id", subscriptionId)
        .single();
      if (error) throw error;
      if (!sub.dunning_policy_id) return { advanced: false, skippedReason: "no_policy" } as AdvanceResult;
      if (!["past_due", "grace"].includes(sub.status)) return { advanced: false, skippedReason: `bad_status:${sub.status}` } as AdvanceResult;

      const stages = await loadStages(sub.dunning_policy_id);
      const nextIndex = (sub.dunning_stage ?? 0);
      const stage = stages[nextIndex];
      if (!stage) return { advanced: false, skippedReason: "no_more_stages" } as AdvanceResult;

      const idem = await withIdempotency(
        { orgId: sub.org_id, opType: "subscription.dunning_step", opKey: `${sub.id}:${nextIndex}`, correlationId: cid },
        async () => runStage(sub, stage, cid),
      );
      return idem.result;
    });
    if (!lock.acquired) return { advanced: false, skippedReason: lock.skippedReason };
    return lock.result!;
  });
}

async function runStage(
  sub: { id: string; org_id: string; status: string; dunning_stage: number },
  stage: Stage,
  cid: string,
): Promise<AdvanceResult> {
  // 1. dispatch notification via outbox (channels-agnostic; consumer routes to email/sms/push)
  if (stage.template_code) {
    await enqueueOutbox({
      aggregateType: "subscription",
      aggregateId: sub.id,
      eventType: "notification.send",
      payload: {
        subscriptionId: sub.id,
        orgId: sub.org_id,
        templateCode: stage.template_code,
        channels: stage.channels,
        stageIndex: stage.stage_index,
        action: stage.action,
      },
      correlationId: cid,
    });
  }

  // 2. escalation actions mutate subscription state
  let escalated: AdvanceResult["escalated"];
  if (stage.action === "suspend") {
    await supabaseAdmin.from("subscriptions").update({ status: "paused" }).eq("id", sub.id);
    escalated = "suspended";
    await enqueueOutbox({
      aggregateType: "subscription", aggregateId: sub.id,
      eventType: "SubscriptionSuspended",
      payload: { subscriptionId: sub.id, orgId: sub.org_id, stageIndex: stage.stage_index },
      correlationId: cid,
    });
  } else if (stage.action === "terminate") {
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("id", sub.id);
    escalated = "terminated";
    await enqueueOutbox({
      aggregateType: "subscription", aggregateId: sub.id,
      eventType: "SubscriptionCancelled",
      payload: { subscriptionId: sub.id, orgId: sub.org_id, reason: "dunning_terminate", stageIndex: stage.stage_index },
      correlationId: cid,
    });
  } else if (stage.action === "retry_payment") {
    await enqueueOutbox({
      aggregateType: "subscription", aggregateId: sub.id,
      eventType: "subscription.renew.retry",
      payload: { subscriptionId: sub.id, orgId: sub.org_id, stageIndex: stage.stage_index },
      correlationId: cid,
    });
  }

  // 3. advance cursor + schedule next stage
  const stages = await loadStages(stage.policy_id);
  const nextStage = stages[stage.stage_index + 1];
  const nextDue = nextStage ? new Date(Date.now() + nextStage.offset_days * 86400_000).toISOString() : null;
  await supabaseAdmin
    .from("subscriptions")
    .update({
      dunning_stage: stage.stage_index + 1,
      grace_period_ends_at: nextDue,
    })
    .eq("id", sub.id);

  await writeBillingAudit({
    orgId: sub.org_id,
    action: "subscription.dunning_advanced",
    refType: "subscription",
    refId: sub.id,
    correlationId: cid,
    meta: { stageIndex: stage.stage_index, action: stage.action, channels: stage.channels, escalated },
  });

  await enqueueOutbox({
    aggregateType: "subscription", aggregateId: sub.id,
    eventType: escalated ? "DunningEscalated" : "DunningStarted",
    payload: { subscriptionId: sub.id, orgId: sub.org_id, stageIndex: stage.stage_index, action: stage.action, escalated },
    correlationId: cid,
  });

  return { advanced: true, stageIndex: stage.stage_index, action: stage.action, escalated };
}

/** Scheduler entrypoint — one candidate scan per tick. */
export async function runDunningTick(limit = 100): Promise<{ scanned: number; advanced: number }> {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .in("status", ["past_due", "paused"])
    .not("dunning_policy_id", "is", null)
    .lte("grace_period_ends_at", new Date().toISOString())
    .limit(limit);
  let advanced = 0;
  for (const s of data ?? []) {
    const r = await advanceDunning(s.id);
    if (r.advanced) advanced++;
  }
  return { scanned: data?.length ?? 0, advanced };
}
