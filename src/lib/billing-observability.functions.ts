/**
 * Billing Observability — live KPIs + timeseries for the ops dashboard.
 * Aggregates from gateway_health_samples, subscription_events, outbox_events,
 * dead_letter_queue, webhook_deliveries, and job_runs. All reads are
 * admin-only and platform-wide (per-org filtering added later).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const WINDOWS = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 } as const;
type WindowKey = keyof typeof WINDOWS;

export interface ObservabilitySnapshot {
  window: WindowKey;
  renewalSuccessRate: number | null;
  renewalFailureRate: number | null;
  paymentSuccessRate: number | null;
  paymentFailureRate: number | null;
  retryCount: number;
  retrySuccessRate: number | null;
  dunningConversionRate: number | null;
  gatewayLatencyP50: number | null;
  gatewayLatencyP95: number | null;
  gatewayLatencyP99: number | null;
  circuitBreakers: Array<{ provider: string; mode: string; failuresInWindow: number; open: boolean }>;
  outboxPending: number;
  outboxDead: number;
  dlqSize: number;
  webhookSuccessRate: number | null;
  webhookDelivered: number;
  webhookFailed: number;
  avgRenewalDurationMs: number | null;
  timeseries: Array<{ bucket: string; renewed: number; failed: number; payments: number; paymentFailures: number }>;
}

function pct(ok: number, total: number): number | null {
  return total > 0 ? Math.round((ok / total) * 10000) / 100 : null;
}
function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[idx];
}

async function assertAdmin(context: { supabase: unknown; userId: string }): Promise<void> {
  const rpc = (context.supabase as { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown }> }).rpc;
  const { data } = await rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const getObservabilitySnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ window: z.enum(["24h", "7d", "30d"]).default("24h") }).parse(d))
  .handler(async ({ data, context }): Promise<ObservabilitySnapshot> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const windowMs = WINDOWS[data.window];
    const since = new Date(Date.now() - windowMs).toISOString();

    const [subEvts, gwSamples, outbox, dlq, webhooks, retryPolicies] = await Promise.all([
      supabaseAdmin.from("subscription_events").select("event_type, created_at, subscription_id, payload").gte("created_at", since).limit(20000),
      supabaseAdmin.from("gateway_health_samples").select("provider, mode, op, success, latency_ms, at, error_code").gte("at", since).limit(20000),
      supabaseAdmin.from("outbox_events").select("status").gte("created_at", since).limit(20000),
      supabaseAdmin.from("dead_letter_queue").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("webhook_deliveries").select("status, attempt").gte("created_at", since).limit(20000),
      supabaseAdmin.from("gateway_retry_policies").select("provider, circuit_breaker_threshold, circuit_breaker_window_seconds"),
    ]);

    // Renewals
    const renewed = (subEvts.data ?? []).filter((e) => e.event_type === "renewed").length;
    const failed = (subEvts.data ?? []).filter((e) => e.event_type === "payment_failed").length;
    const renewalSuccessRate = pct(renewed, renewed + failed);
    const renewalFailureRate = renewalSuccessRate === null ? null : Math.round((100 - renewalSuccessRate) * 100) / 100;

    // Payments (from gateway samples where op = 'charge')
    const chargeSamples = (gwSamples.data ?? []).filter((s) => s.op === "charge");
    const chargeOk = chargeSamples.filter((s) => s.success).length;
    const chargeFail = chargeSamples.length - chargeOk;
    const paymentSuccessRate = pct(chargeOk, chargeSamples.length);
    const paymentFailureRate = paymentSuccessRate === null ? null : Math.round((100 - paymentSuccessRate) * 100) / 100;

    // Latency
    const latencies = chargeSamples.map((s) => Number(s.latency_ms) || 0).sort((a, b) => a - b);
    const gatewayLatencyP50 = quantile(latencies, 0.5);
    const gatewayLatencyP95 = quantile(latencies, 0.95);
    const gatewayLatencyP99 = quantile(latencies, 0.99);

    // Circuit breakers (per provider/mode)
    const breakersMap = new Map<string, { provider: string; mode: string; failuresInWindow: number; open: boolean }>();
    const policyByProvider = new Map((retryPolicies.data ?? []).map((p) => [p.provider as string, p]));
    for (const s of chargeSamples) {
      if (s.success) continue;
      const k = `${s.provider}:${s.mode}`;
      const b = breakersMap.get(k) ?? { provider: s.provider as string, mode: s.mode as string, failuresInWindow: 0, open: false };
      b.failuresInWindow++;
      breakersMap.set(k, b);
    }
    for (const b of breakersMap.values()) {
      const p = policyByProvider.get(b.provider);
      const threshold = (p?.circuit_breaker_threshold as number) ?? 5;
      b.open = b.failuresInWindow >= threshold;
    }

    // Retries (webhook + job retries approximation)
    const retryCount = (webhooks.data ?? []).reduce((n, w) => n + Math.max(0, (w.attempt as number) - 1), 0);
    const webhookDelivered = (webhooks.data ?? []).filter((w) => w.status === "delivered").length;
    const webhookFailed = (webhooks.data ?? []).filter((w) => w.status === "failed" || w.status === "dead").length;
    const webhookSuccessRate = pct(webhookDelivered, webhookDelivered + webhookFailed);
    const retrySuccessRate = retryCount > 0 ? pct(webhookDelivered, webhookDelivered + webhookFailed) : null;

    // Dunning conversion (past_due → renewed within window)
    const failedSubs = new Set<string>();
    const renewedSubs = new Set<string>();
    for (const e of subEvts.data ?? []) {
      if (e.event_type === "payment_failed") failedSubs.add(e.subscription_id as string);
      else if (e.event_type === "renewed") renewedSubs.add(e.subscription_id as string);
    }
    let recovered = 0;
    failedSubs.forEach((s) => { if (renewedSubs.has(s)) recovered++; });
    const dunningConversionRate = failedSubs.size ? pct(recovered, failedSubs.size) : null;

    // Outbox & DLQ
    const outboxRows = outbox.data ?? [];
    const outboxPending = outboxRows.filter((o) => o.status === "pending" || o.status === "in_flight").length;
    const outboxDead = outboxRows.filter((o) => o.status === "dead").length;
    const dlqSize = (dlq.count as number) ?? 0;

    // Timeseries — bucket by hour(24h) / day(7d,30d)
    const bucketMs = data.window === "24h" ? 3_600_000 : 86_400_000;
    const buckets = new Map<string, { renewed: number; failed: number; payments: number; paymentFailures: number }>();
    const bucketOf = (iso: string) => new Date(Math.floor(new Date(iso).getTime() / bucketMs) * bucketMs).toISOString();
    for (const e of subEvts.data ?? []) {
      const k = bucketOf(e.created_at as string);
      const b = buckets.get(k) ?? { renewed: 0, failed: 0, payments: 0, paymentFailures: 0 };
      if (e.event_type === "renewed") b.renewed++;
      else if (e.event_type === "payment_failed") b.failed++;
      buckets.set(k, b);
    }
    for (const s of chargeSamples) {
      const k = bucketOf(s.at as string);
      const b = buckets.get(k) ?? { renewed: 0, failed: 0, payments: 0, paymentFailures: 0 };
      b.payments++;
      if (!s.success) b.paymentFailures++;
      buckets.set(k, b);
    }
    const timeseries = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([bucket, v]) => ({ bucket, ...v }));

    // Avg renewal duration (rough: chargeSamples latency mean)
    const avgRenewalDurationMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;

    return {
      window: data.window,
      renewalSuccessRate, renewalFailureRate,
      paymentSuccessRate, paymentFailureRate,
      retryCount, retrySuccessRate,
      dunningConversionRate,
      gatewayLatencyP50, gatewayLatencyP95, gatewayLatencyP99,
      circuitBreakers: Array.from(breakersMap.values()),
      outboxPending, outboxDead, dlqSize,
      webhookSuccessRate, webhookDelivered, webhookFailed,
      avgRenewalDurationMs,
      timeseries,
    };
  });
