/**
 * Gateway health monitoring: latency, success rate, and error breakdown
 * per payment provider. Every adapter call is instrumented via
 * `recordGatewaySample()`; dashboards read `getGatewayHealth()`.
 *
 * Also implements a simple in-Worker circuit breaker: if the failure
 * count within `windowSeconds` exceeds `threshold`, `isCircuitOpen()`
 * returns true and callers should short-circuit with a friendly error
 * instead of hammering the gateway.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PaymentProvider, PaymentMode } from "./payments/types";
import { getRetryPolicy } from "./gateway-retry-policy.server";
import { currentCorrelationId } from "./correlation.server";

interface Failure { at: number }
const failures = new Map<string, Failure[]>();

function key(p: PaymentProvider, mode: PaymentMode) { return `${p}:${mode}`; }

export async function recordGatewaySample(input: {
  provider: PaymentProvider;
  mode: PaymentMode;
  op: string;
  latencyMs: number;
  success: boolean;
  errorCode?: string | null;
  correlationId?: string;
}): Promise<void> {
  const cid = input.correlationId || currentCorrelationId() || null;
  try {
    await supabaseAdmin.from("gateway_health_samples").insert({
      provider: input.provider,
      mode: input.mode,
      op: input.op,
      latency_ms: Math.max(0, Math.round(input.latencyMs)),
      success: input.success,
      error_code: input.errorCode ?? null,
      correlation_id: cid,
    });
  } catch (e) {
    console.error("[gateway-health] sample insert failed", e);
  }
  if (!input.success) {
    const k = key(input.provider, input.mode);
    const arr = failures.get(k) ?? [];
    arr.push({ at: Date.now() });
    failures.set(k, arr);
  }
}

export async function isCircuitOpen(provider: PaymentProvider, mode: PaymentMode): Promise<boolean> {
  const policy = await getRetryPolicy(provider);
  const k = key(provider, mode);
  const now = Date.now();
  const windowMs = policy.circuitBreakerWindowSeconds * 1000;
  const arr = (failures.get(k) ?? []).filter((f) => now - f.at < windowMs);
  failures.set(k, arr);
  return arr.length >= policy.circuitBreakerThreshold;
}

export interface HealthSummary {
  provider: PaymentProvider;
  mode: PaymentMode;
  samples: number;
  successRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  errorBreakdown: Record<string, number>;
}

export async function getGatewayHealth(sinceMinutes = 60): Promise<HealthSummary[]> {
  const since = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
  const { data } = await supabaseAdmin
    .from("gateway_health_samples")
    .select("provider, mode, latency_ms, success, error_code")
    .gte("at", since)
    .limit(10000);
  const groups = new Map<string, { provider: string; mode: string; lat: number[]; ok: number; err: Record<string, number> }>();
  for (const r of data ?? []) {
    const k = `${r.provider}:${r.mode}`;
    const g = groups.get(k) ?? { provider: r.provider, mode: r.mode, lat: [], ok: 0, err: {} };
    g.lat.push(r.latency_ms);
    if (r.success) g.ok++;
    else if (r.error_code) g.err[r.error_code] = (g.err[r.error_code] ?? 0) + 1;
    groups.set(k, g);
  }
  const pct = (a: number[], p: number) => {
    if (!a.length) return 0;
    const s = [...a].sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  };
  return Array.from(groups.values()).map((g) => ({
    provider: g.provider as PaymentProvider,
    mode: g.mode as PaymentMode,
    samples: g.lat.length,
    successRate: g.lat.length ? Math.round((g.ok / g.lat.length) * 10000) / 100 : 0,
    p50LatencyMs: pct(g.lat, 50),
    p95LatencyMs: pct(g.lat, 95),
    errorBreakdown: g.err,
  }));
}
