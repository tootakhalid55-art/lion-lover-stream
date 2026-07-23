/**
 * Aggregate billing metrics for dashboards and alerting:
 * - recurring billing success rate (24h / 7d)
 * - renewal success and failed collections
 * - dunning recovery rate
 * - average retry count per operation
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface BillingMetrics {
  orgId: string | null; // null = platform-wide aggregate
  renewed24h: number;
  failed24h: number;
  renewed7d: number;
  failed7d: number;
  successRate24h: number | null;
  successRate7d: number | null;
  avgRetry7d: number;
  recoveryRate7d: number | null; // recovered_from_past_due / total_past_due
}

export async function getBillingMetrics(orgId?: string): Promise<BillingMetrics> {
  const q = supabaseAdmin.from("billing_metrics_recent").select("*");
  const { data } = orgId ? await q.eq("org_id", orgId).maybeSingle() : await q.limit(1000);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const agg = rows.reduce(
    (a, r) => ({
      renewed24h: a.renewed24h + (r.renewed_24h ?? 0),
      failed24h: a.failed24h + (r.failed_24h ?? 0),
      renewed7d: a.renewed7d + (r.renewed_7d ?? 0),
      failed7d: a.failed7d + (r.failed_7d ?? 0),
      avgRetryTot: a.avgRetryTot + Number(r.avg_retry_7d ?? 0),
      n: a.n + 1,
    }),
    { renewed24h: 0, failed24h: 0, renewed7d: 0, failed7d: 0, avgRetryTot: 0, n: 0 },
  );
  const rate = (ok: number, fail: number) => (ok + fail > 0 ? Math.round((ok / (ok + fail)) * 10000) / 100 : null);

  // Recovery rate: count past_due events that later became renewed within 7d.
  let recoveryRate7d: number | null = null;
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const evtQ = supabaseAdmin
    .from("subscription_events")
    .select("subscription_id, event_type")
    .in("event_type", ["payment_failed", "renewed"])
    .gte("created_at", since);
  const { data: evts } = orgId ? await evtQ.eq("org_id", orgId) : await evtQ.limit(5000);
  if (evts && evts.length) {
    const failedSubs = new Set<string>();
    const renewedSubs = new Set<string>();
    for (const e of evts) {
      if (e.event_type === "payment_failed") failedSubs.add(e.subscription_id as string);
      else if (e.event_type === "renewed") renewedSubs.add(e.subscription_id as string);
    }
    if (failedSubs.size) {
      let recovered = 0;
      failedSubs.forEach((s) => { if (renewedSubs.has(s)) recovered++; });
      recoveryRate7d = Math.round((recovered / failedSubs.size) * 10000) / 100;
    }
  }

  return {
    orgId: orgId ?? null,
    renewed24h: agg.renewed24h,
    failed24h: agg.failed24h,
    renewed7d: agg.renewed7d,
    failed7d: agg.failed7d,
    successRate24h: rate(agg.renewed24h, agg.failed24h),
    successRate7d: rate(agg.renewed7d, agg.failed7d),
    avgRetry7d: agg.n ? Math.round((agg.avgRetryTot / agg.n) * 100) / 100 : 0,
    recoveryRate7d,
  };
}
