/**
 * Normalize any gateway / network / adapter error into a small, stable
 * taxonomy the dunning engine and metrics can reason about. Adapters are
 * free to attach provider-specific codes; the workflow layer only
 * branches on these normalized reasons.
 */

export type FailureReason =
  | "retryable_network"        // timeout, DNS, connection reset — safe to retry
  | "gateway_timeout"          // provider accepted but did not respond
  | "gateway_unavailable"      // 5xx from provider, circuit open
  | "insufficient_funds"       // card declined, retry after dunning
  | "card_expired"             // needs new payment method
  | "card_declined"            // generic decline, retry limited
  | "authentication_required"  // 3DS / SCA challenge pending
  | "fraud_suspected"          // provider blocked, do not retry
  | "user_cancelled"           // customer aborted checkout
  | "duplicate_callback"       // already processed, no-op
  | "invalid_request"          // bug — do not retry
  | "unknown";                 // fallback

export interface NormalizedFailure {
  reason: FailureReason;
  retryable: boolean;
  permanent: boolean;
  message: string;
  providerCode?: string;
  httpStatus?: number;
}

interface RawError {
  code?: string;
  kind?: string;
  status?: number;
  message?: string;
  providerCode?: string;
}

export function normalizeFailure(e: unknown): NormalizedFailure {
  const raw: RawError = (e && typeof e === "object" ? (e as RawError) : { message: String(e) });
  const msg = raw.message ?? "unknown failure";
  const code = (raw.code || raw.kind || "").toLowerCase();
  const status = raw.status;

  const map = (reason: FailureReason, opts: { retryable: boolean; permanent: boolean }): NormalizedFailure => ({
    reason, message: msg, providerCode: raw.providerCode ?? raw.code, httpStatus: status, ...opts,
  });

  if (code === "circuit_open" || code === "gateway_unavailable") return map("gateway_unavailable", { retryable: true, permanent: false });
  if (code === "timeout" || code === "gateway_timeout" || code === "etimedout") return map("gateway_timeout", { retryable: true, permanent: false });
  if (code === "econnreset" || code === "enotfound" || code === "network_error") return map("retryable_network", { retryable: true, permanent: false });
  if (code === "insufficient_funds") return map("insufficient_funds", { retryable: true, permanent: false });
  if (code === "card_expired" || code === "expired_card") return map("card_expired", { retryable: false, permanent: true });
  if (code === "card_declined" || code === "do_not_honor") return map("card_declined", { retryable: true, permanent: false });
  if (code === "authentication_required" || code === "requires_action" || code === "3ds_required") return map("authentication_required", { retryable: false, permanent: false });
  if (code === "fraud" || code === "fraudulent") return map("fraud_suspected", { retryable: false, permanent: true });
  if (code === "user_cancelled" || code === "canceled_by_user") return map("user_cancelled", { retryable: false, permanent: true });
  if (code === "duplicate" || code === "already_processed") return map("duplicate_callback", { retryable: false, permanent: false });
  if (code === "invalid_request" || code === "validation_failed") return map("invalid_request", { retryable: false, permanent: true });

  if (typeof status === "number") {
    if (status >= 500) return map("gateway_unavailable", { retryable: true, permanent: false });
    if (status === 408 || status === 504) return map("gateway_timeout", { retryable: true, permanent: false });
    if (status === 402) return map("card_declined", { retryable: true, permanent: false });
    if (status === 409) return map("duplicate_callback", { retryable: false, permanent: false });
    if (status === 400 || status === 422) return map("invalid_request", { retryable: false, permanent: true });
  }

  return map("unknown", { retryable: true, permanent: false });
}
