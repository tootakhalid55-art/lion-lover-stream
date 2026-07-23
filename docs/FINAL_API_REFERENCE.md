# FINAL API Reference — Nova TV v1.0.0

Machine-readable OpenAPI 3.1 spec: `GET /api/v1/openapi` (also served at `/api/v1/docs`).

## Authentication
- **Bearer API key** in `Authorization: Bearer sk_...` header.
- Keys are bcrypt-hashed at rest; scopes enforced per endpoint.
- Rate limited per org (`src/lib/rate-limit.server.ts`).
- All requests correlation-ID tagged; audit logged.

## REST v1 endpoints

| Method | Path                              | Scope                | Purpose |
|-------:|-----------------------------------|----------------------|---------|
|   GET  | `/api/v1/health/live`             | public               | Liveness probe |
|   GET  | `/api/v1/health/ready`            | public               | Readiness (DB + upstream) |
|   GET  | `/api/v1/health/version`          | public               | Build + git sha |
|   GET  | `/api/v1/openapi`                 | public               | OpenAPI 3.1 JSON |
|   GET  | `/api/v1/docs`                    | public               | Swagger UI |
|   GET  | `/api/v1/packages`                | `packages:read`      | List packages |
|   GET  | `/api/v1/licenses`                | `licenses:read`      | List licenses |
|   GET  | `/api/v1/licenses/:id`            | `licenses:read`      | License detail |
|   GET  | `/api/v1/invoices`                | `invoices:read`      | Paged invoices |
|   GET  | `/api/v1/invoices/:id`            | `invoices:read`      | Invoice detail |
|  POST  | `/api/v1/orders`                  | `orders:write`       | Create order (idempotent) |
|   *    | `/api/v1/webhooks/endpoints`      | `webhooks:manage`    | Manage outbound endpoints |

## Internal / operational

| Method | Path                                     | Purpose |
|-------:|------------------------------------------|---------|
|   GET  | `/api/billing/invoices/:id.pdf`          | Signed invoice PDF |
|   GET  | `/api/admin/export/:file`                | Admin data export |
|   GET  | `/api/public/stream/:kind/:file`         | Media proxy (Xtream) |
|   GET  | `/api/debug/xtream`                      | Xtream diagnostics (admin only) |

## Server functions (RPC)
136 typed `createServerFn` handlers across 23 modules in `src/lib/*.functions.ts`.
Called only from routers/components; not exposed as raw HTTP.

## Outbound webhooks
- HMAC-SHA256 signed (`X-Nova-Signature`), timestamped, replay-protected (`X-Nova-Timestamp`).
- Retries: exponential backoff, DLQ on exhaustion.
- Events: `invoice.paid`, `invoice.voided`, `subscription.renewed`, `subscription.expired`,
  `payment.succeeded`, `payment.failed`, `payment.refunded`, `license.issued`, `license.revoked`.

## Error envelope
```json
{ "error": { "code": "string", "message": "string", "correlation_id": "uuid" } }
```
