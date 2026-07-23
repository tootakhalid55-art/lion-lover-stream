/**
 * Retry policy per payment gateway. Loaded from
 * public.gateway_retry_policies with a short in-Worker cache. Adapters
 * use this to decide (a) whether to retry a given error and (b) how
 * long to wait before the next attempt.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PaymentProvider } from "./payments/types";

export interface RetryPolicy {
  provider: PaymentProvider;
  maxAttempts: number;
  backoffSeconds: number[];
  retryOn: string[]; // "network" | "5xx" | "rate_limited" | "timeout" | provider-specific codes
  circuitBreakerThreshold: number;
  circuitBreakerWindowSeconds: number;
}

const DEFAULT: RetryPolicy = {
  provider: "stripe",
  maxAttempts: 5,
  backoffSeconds: [30, 120, 600, 1800, 7200],
  retryOn: ["network", "5xx", "rate_limited", "timeout"],
  circuitBreakerThreshold: 10,
  circuitBreakerWindowSeconds: 300,
};

const cache = new Map<PaymentProvider, { policy: RetryPolicy; at: number }>();
const TTL_MS = 60_000;

export async function getRetryPolicy(provider: PaymentProvider): Promise<RetryPolicy> {
  const hit = cache.get(provider);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.policy;
  const { data } = await supabaseAdmin
    .from("gateway_retry_policies")
    .select("*")
    .eq("provider", provider)
    .maybeSingle();
  const policy: RetryPolicy = data
    ? {
        provider,
        maxAttempts: data.max_attempts,
        backoffSeconds: (data.backoff_seconds as number[]) ?? DEFAULT.backoffSeconds,
        retryOn: (data.retry_on as string[]) ?? DEFAULT.retryOn,
        circuitBreakerThreshold: data.circuit_breaker_threshold,
        circuitBreakerWindowSeconds: data.circuit_breaker_window_seconds,
      }
    : { ...DEFAULT, provider };
  cache.set(provider, { policy, at: Date.now() });
  return policy;
}

export function shouldRetry(policy: RetryPolicy, err: { code?: string; status?: number; kind?: string }): boolean {
  if (err.kind && policy.retryOn.includes(err.kind)) return true;
  if (err.status && err.status >= 500 && policy.retryOn.includes("5xx")) return true;
  if (err.status === 429 && policy.retryOn.includes("rate_limited")) return true;
  if (err.code && policy.retryOn.includes(err.code)) return true;
  return false;
}

export function backoffFor(policy: RetryPolicy, attempt: number): number {
  const i = Math.min(attempt - 1, policy.backoffSeconds.length - 1);
  const base = policy.backoffSeconds[Math.max(0, i)];
  const jitter = Math.floor(Math.random() * Math.min(base * 0.2, 30));
  return base + jitter;
}
