/**
 * Correlation ID helpers. Every API request either passes an
 * X-Correlation-ID header or receives a freshly-minted one. The ID is
 * written into audit_logs, billing_events, webhook_deliveries so a single
 * operation can be traced end-to-end.
 */
import { getRequestHeader } from "@tanstack/react-start/server";

export function correlationFromRequest(request?: Request): string {
  const fromReq = request?.headers.get("x-correlation-id");
  if (fromReq && /^[a-zA-Z0-9._:-]{6,128}$/.test(fromReq)) return fromReq;
  try {
    const fromCtx = getRequestHeader("x-correlation-id");
    if (fromCtx && /^[a-zA-Z0-9._:-]{6,128}$/.test(fromCtx)) return fromCtx;
  } catch {
    /* not in a request scope */
  }
  return `cid_${crypto.randomUUID()}`;
}
