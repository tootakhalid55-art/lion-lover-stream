/**
 * Canonical scope list for API keys. Keep additions backward-compatible
 * within v1 — never rename or remove a scope; deprecate + add new one.
 */
export const API_SCOPES = [
  "users:read",
  "users:write",
  "packages:read",
  "packages:write",
  "licenses:read",
  "licenses:write",
  "codes:read",
  "codes:write",
  "devices:read",
  "devices:write",
  "sessions:read",
  "sessions:write",
  "orders:read",
  "orders:write",
  "wallet:read",
  "wallet:write",
  "invoices:read",
  "invoices:write",
  "payments:read",
  "payments:write",
  "subscriptions:read",
  "resellers:read",
  "resellers:manage",
  "webhooks:read",
  "webhooks:manage",
  "billing:read",
  "notifications:read",
  "audit:read",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export function isValidScope(s: string): s is ApiScope {
  return (API_SCOPES as readonly string[]).includes(s);
}
