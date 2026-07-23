/**
 * Reusable REST v1 route helper. Every route wraps its handlers with:
 *   - CORS preflight
 *   - API key authentication + scope enforcement
 *   - Correlation ID
 *   - Idempotency (POST/PATCH/DELETE only, when Idempotency-Key present)
 *   - Request logging
 *   - Uniform error envelope
 */
import { authenticateApi, logApiRequest, type ApiAuthContext } from "./api-auth.server";
import type { ApiScope } from "./api-scopes";
import { errorResponse, jsonResponse, optionsResponse, type ApiEnvelope } from "./api-response.server";
import { idempotencyBegin, idempotencyStore, requestHash } from "./idempotency.server";
import { correlationFromRequest } from "./correlation.server";

export interface V1Handler {
  scopes: ApiScope[];
  fn: (args: {
    ctx: ApiAuthContext;
    request: Request;
    params: Record<string, string>;
    body: any;
  }) => Promise<ApiEnvelope<unknown> & { status?: number }>;
}

export type V1Handlers = Partial<Record<"GET" | "POST" | "PATCH" | "DELETE", V1Handler>>;

async function readBody(request: Request): Promise<{ raw: string; json: any }> {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "DELETE") return { raw: "", json: null };
  const raw = await request.text();
  if (!raw) return { raw: "", json: null };
  try {
    return { raw, json: JSON.parse(raw) };
  } catch {
    return { raw, json: null };
  }
}

export function makeV1Handler(handlers: V1Handlers, path: string) {
  return async (args: { request: Request; params: Record<string, string> }): Promise<Response> => {
    const { request, params } = args;
    const method = request.method.toUpperCase() as keyof V1Handlers;
    if (method === ("OPTIONS" as any)) return optionsResponse(correlationFromRequest(request));

    const handler = handlers[method as keyof V1Handlers];
    if (!handler) {
      return errorResponse(
        "method_not_allowed",
        `Method ${method} not allowed`,
        405,
        correlationFromRequest(request),
      );
    }

    const auth = await authenticateApi(request, handler.scopes);
    if (!auth.ok) {
      const started = Date.now();
      // Fire-and-forget log even for unauthenticated attempts (no keyId/org).
      return errorResponse(auth.error.code, auth.error.message, auth.error.status, auth.correlationId);
    }

    const { ctx } = auth;
    const { raw: rawBody, json: jsonBody } = await readBody(request);
    const idemKey = request.headers.get("idempotency-key");
    const started = Date.now();

    // Idempotency: only for mutations.
    if (idemKey && (method === "POST" || method === "PATCH" || method === "DELETE")) {
      const hash = await requestHash(String(method), path, rawBody);
      const found = await idempotencyBegin(ctx.orgId, ctx.keyId, idemKey, String(method), path, hash, ctx.correlationId);
      if (found.status === "conflict") {
        const resp = errorResponse(
          "idempotency_conflict",
          "Idempotency-Key already used with a different request body",
          409,
          ctx.correlationId,
        );
        await logApiRequest(ctx, String(method), path, 409, Date.now() - started);
        return resp;
      }
      if (found.status === "replay" && found.response) {
        await logApiRequest(ctx, String(method), path, found.response.status, Date.now() - started);
        return new Response(found.response.body, {
          status: found.response.status,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "x-correlation-id": ctx.correlationId,
            "x-api-version": "1.0.0",
            "x-idempotent-replay": "true",
          },
        });
      }
    }

    try {
      const result = await handler.fn({ ctx, request, params, body: jsonBody });
      const status = result.status ?? 200;
      const response = jsonResponse(result, { status, correlationId: ctx.correlationId });

      if (idemKey && (method === "POST" || method === "PATCH" || method === "DELETE") && status < 500) {
        const bodyText = await response.clone().text();
        await idempotencyStore(ctx.orgId, idemKey, String(method), path, status, bodyText);
      }

      await logApiRequest(ctx, String(method), path, status, Date.now() - started);
      return response;
    } catch (err: any) {
      const msg = err?.message || "Internal error";
      const status = /forbidden/i.test(msg) ? 403 : /not found/i.test(msg) ? 404 : 500;
      const resp = errorResponse(status === 500 ? "internal" : "request_failed", msg, status, ctx.correlationId);
      await logApiRequest(ctx, String(method), path, status, Date.now() - started);
      return resp;
    }
  };
}

export function parseListParams(url: URL): {
  limit: number;
  cursor: string | null;
  q: string | null;
  sort: string | null;
  from: string | null;
  to: string | null;
} {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50"), 1), 200);
  return {
    limit,
    cursor: url.searchParams.get("cursor"),
    q: url.searchParams.get("q"),
    sort: url.searchParams.get("sort"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  };
}
