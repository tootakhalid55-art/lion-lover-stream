/**
 * Correlation ID helpers. Every API request either passes an
 * X-Correlation-ID header or receives a freshly-minted one. The ID is
 * written into audit_logs, billing_events, subscription_events,
 * outbox_events, webhook_deliveries, billing_idempotency,
 * gateway_health_samples, and gateway_webhook_events so a single
 * operation is traceable end-to-end.
 *
 * Jobs and background workers propagate via `runWithCorrelation()` +
 * `currentCorrelationId()` (backed by AsyncLocalStorage on nodejs_compat).
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { getRequestHeader } from "@tanstack/react-start/server";

const store = new AsyncLocalStorage<{ correlationId: string }>();

const RE = /^[a-zA-Z0-9._:-]{6,128}$/;

export function newCorrelationId(prefix = "cid"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function correlationFromRequest(request?: Request): string {
  const fromReq = request?.headers.get("x-correlation-id");
  if (fromReq && RE.test(fromReq)) return fromReq;
  try {
    const fromCtx = getRequestHeader("x-correlation-id");
    if (fromCtx && RE.test(fromCtx)) return fromCtx;
  } catch { /* not in a request scope */ }
  const active = store.getStore()?.correlationId;
  if (active) return active;
  return newCorrelationId();
}

export function currentCorrelationId(): string | undefined {
  return store.getStore()?.correlationId;
}

export async function runWithCorrelation<T>(correlationId: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ correlationId }, fn);
}
