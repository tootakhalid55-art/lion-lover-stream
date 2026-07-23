/**
 * OpenAPI 3.1 document for REST API v1. Kept in a single module so it stays
 * in lock-step with the route implementations. Consumed by /api/v1/openapi.json
 * and by the Swagger UI page.
 */
import { API_SCOPES } from "./api-scopes";
import { WEBHOOK_EVENTS } from "./webhooks.server";

export function buildOpenApiDoc(baseUrl: string): Record<string, unknown> {
  const secScheme = { bearerAuth: [] as string[] };
  const commonResponses = {
    Unauthorized: { description: "Missing or invalid API key" },
    Forbidden: { description: "Missing scope or tenant access denied" },
    RateLimited: { description: "Rate limit exceeded" },
    NotFound: { description: "Resource not found" },
  };

  const listResource = (name: string, scope: string) => ({
    get: {
      summary: `List ${name}`,
      tags: [name],
      security: [{ bearerAuth: [scope] }],
      parameters: [
        { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 200 } },
        { in: "query", name: "cursor", schema: { type: "string" } },
        { in: "query", name: "q", schema: { type: "string" } },
        { in: "query", name: "from", schema: { type: "string", format: "date-time" } },
        { in: "query", name: "to", schema: { type: "string", format: "date-time" } },
      ],
      responses: { "200": { description: `${name} list` }, ...commonResponses },
    },
  });

  return {
    openapi: "3.1.0",
    info: {
      title: "Nova TV Platform API",
      version: "1.0.0",
      description:
        "Official REST API for Nova TV. Authenticate with an API key issued from the admin panel. Every request/response carries an `X-Correlation-ID` header for traceability.",
    },
    servers: [{ url: `${baseUrl}/api/v1` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "nvk_<prefix>_<secret>" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: {},
              },
            },
            meta: {
              type: "object",
              properties: {
                correlation_id: { type: "string" },
                api_version: { type: "string" },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: API_SCOPES as unknown as string[] }],
    tags: [
      { name: "licenses" },
      { name: "packages" },
      { name: "orders" },
      { name: "invoices" },
      { name: "webhooks" },
    ],
    "x-webhook-events": WEBHOOK_EVENTS,
    "x-scopes": API_SCOPES,
    paths: {
      "/licenses": listResource("licenses", "licenses:read"),
      "/licenses/{id}": {
        get: {
          summary: "Get license by id",
          tags: ["licenses"],
          security: [{ bearerAuth: ["licenses:read"] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "License" }, ...commonResponses },
        },
      },
      "/packages": listResource("packages", "packages:read"),
      "/orders": {
        ...listResource("orders", "orders:read"),
        post: {
          summary: "Create order",
          tags: ["orders"],
          security: [{ bearerAuth: ["orders:write"] }],
          parameters: [{ in: "header", name: "Idempotency-Key", schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["package_id", "qty"],
                  properties: {
                    package_id: { type: "string" },
                    qty: { type: "integer", minimum: 1 },
                    promo_code: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Order created" }, "409": { description: "Idempotency conflict" }, ...commonResponses },
        },
      },
      "/invoices": listResource("invoices", "invoices:read"),
      "/invoices/{id}": {
        get: {
          summary: "Get invoice",
          tags: ["invoices"],
          security: [{ bearerAuth: ["invoices:read"] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Invoice" }, ...commonResponses },
        },
      },
      "/webhooks/endpoints": {
        get: {
          summary: "List webhook endpoints",
          tags: ["webhooks"],
          security: [{ bearerAuth: ["webhooks:read"] }],
          responses: { "200": { description: "Endpoints" }, ...commonResponses },
        },
        post: {
          summary: "Create webhook endpoint",
          tags: ["webhooks"],
          security: [{ bearerAuth: ["webhooks:manage"] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url", "events"],
                  properties: {
                    url: { type: "string", format: "uri" },
                    description: { type: "string" },
                    events: { type: "array", items: { type: "string", enum: WEBHOOK_EVENTS as unknown as string[] } },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Created; returns HMAC secret exactly once" }, ...commonResponses },
        },
      },
    },
  };
}
