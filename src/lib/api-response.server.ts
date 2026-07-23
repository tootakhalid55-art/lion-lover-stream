/**
 * Uniform JSON response helper for REST API v1. Attaches correlation id,
 * API version, and CORS headers so external SDKs (browser + native) work
 * out of the box.
 */
export const API_VERSION = "1.0.0";

export interface ApiEnvelope<T> {
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  meta?: {
    correlation_id: string;
    api_version: string;
    page?: { cursor?: string | null; next_cursor?: string | null; total?: number };
  };
}

export function jsonResponse<T>(
  body: ApiEnvelope<T>,
  init: { status?: number; correlationId: string; extraHeaders?: Record<string, string> },
): Response {
  const enriched: ApiEnvelope<T> = {
    ...body,
    meta: {
      correlation_id: init.correlationId,
      api_version: API_VERSION,
      ...(body.meta ?? {}),
    },
  };
  return new Response(JSON.stringify(enriched), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-correlation-id": init.correlationId,
      "x-api-version": API_VERSION,
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization,content-type,idempotency-key,x-correlation-id",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-expose-headers": "x-correlation-id,x-api-version,x-ratelimit-remaining,x-ratelimit-reset",
      ...(init.extraHeaders ?? {}),
    },
  });
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  correlationId: string,
  details?: unknown,
): Response {
  return jsonResponse({ error: { code, message, details } }, { status, correlationId });
}

export function optionsResponse(correlationId: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization,content-type,idempotency-key,x-correlation-id",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-max-age": "86400",
      "x-correlation-id": correlationId,
    },
  });
}
