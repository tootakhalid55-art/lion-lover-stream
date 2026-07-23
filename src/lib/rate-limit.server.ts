/**
 * In-memory token-bucket rate limiter.
 * Scope: per Worker instance — best effort, not distributed. Enough to
 * damp abusive bursts from a single client; for strict cross-instance
 * limits back this with a shared store.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5000;

function gc() {
  if (buckets.size <= MAX_KEYS) return;
  const drop = Math.ceil(MAX_KEYS * 0.1);
  const keys = Array.from(buckets.keys()).slice(0, drop);
  for (const k of keys) buckets.delete(k);
}

export interface RateLimitOptions {
  /** Maximum tokens (burst size). */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: opts.capacity, updatedAt: now };
    buckets.set(key, b);
    gc();
  }
  const elapsed = (now - b.updatedAt) / 1000;
  b.tokens = Math.min(opts.capacity, b.tokens + elapsed * opts.refillPerSec);
  b.updatedAt = now;
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { allowed: true, retryAfterMs: 0 };
  }
  const missing = 1 - b.tokens;
  return { allowed: false, retryAfterMs: Math.ceil((missing / opts.refillPerSec) * 1000) };
}

/** Best-effort client identifier from a Request. */
export function clientKey(request: Request): string {
  const h = request.headers;
  const fwd = h.get("cf-connecting-ip") || h.get("x-real-ip") || h.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || "unknown";
  return ip;
}

/**
 * Per-organization rate limiter for billing APIs and webhook endpoints.
 * Defaults tuned for interactive dashboards (60/min) and inbound webhooks
 * (120/min per provider). Fall back to client IP when org is unknown.
 */
export const BILLING_ORG_LIMIT: RateLimitOptions = { capacity: 60, refillPerSec: 1 };
export const WEBHOOK_ORG_LIMIT: RateLimitOptions = { capacity: 120, refillPerSec: 2 };

export function orgKey(scope: string, orgId: string): string {
  return `org:${orgId}:${scope}`;
}

export function providerWebhookKey(provider: string, orgIdOrIp: string): string {
  return `wh:${provider}:${orgIdOrIp}`;
}

export function rateLimitOrg(scope: string, orgId: string, opts: RateLimitOptions = BILLING_ORG_LIMIT): RateLimitResult {
  return rateLimit(orgKey(scope, orgId), opts);
}
