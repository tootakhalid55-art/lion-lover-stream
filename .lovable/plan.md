# Sub-phase 2C — Resellers, REST API, Billing

Massive scope. I'll ship it as one migration + versioned public API + reseller/billing server modules + admin & customer portals, then tests. Everything RBAC-gated, tenant-isolated, and audited. No hardcoded prices, no hardcoded gateways.

## 1. Database migration (single call)

New tables (all with GRANT → RLS → POLICY, `tenant_id uuid` on every row):

- `organizations` — id, name, slug, type (`platform`|`master_distributor`|`distributor`|`reseller`|`sub_reseller`|`customer`), parent_id (self-FK), status, currency, country, meta jsonb.
- `reseller_profiles` — org_id, company, contact_name, email, phone, address jsonb, balance_cents, credit_limit_cents, price_level, commission_model jsonb, notes.
- `org_members` — org_id, user_id, role (`owner`|`admin`|`billing`|`support`|`viewer`), unique(org,user).
- `package_pricing` — id, package_id, org_id (nullable = default), price_cents, currency, region, discount_pct, margin_pct, promo_starts, promo_ends, visible, effective_from/to.
- `promo_codes` — code, kind (`percent`|`amount`|`credits`), value, currency, package_id?, org_id?, max_uses, used_count, expires_at.
- `wallet_ledger` — org_id, delta_cents, currency, kind (`topup`|`purchase`|`refund`|`commission`|`adjustment`), ref_type, ref_id, memo, balance_after_cents.
- `license_orders` — id, org_id (reseller/customer), package_id, qty, unit_price_cents, currency, discount_cents, tax_cents, total_cents, status (`pending`|`paid`|`fulfilled`|`refunded`|`void`), invoice_id?.
- `subscriptions` — id, org_id, plan_id, status (`trialing`|`active`|`past_due`|`canceled`|`paused`), current_period_start/end, cancel_at, trial_ends_at, quantity, meta.
- `billing_plans` — id, name, code, interval (`month`|`year`|`custom`), price_cents, currency, features jsonb, usage_components jsonb (metric → unit price), trial_days, visible.
- `invoices` — id, org_id, number, status (`draft`|`open`|`paid`|`void`|`uncollectible`), currency, subtotal_cents, tax_cents, discount_cents, total_cents, due_at, paid_at, pdf_url, meta.
- `invoice_lines` — invoice_id, description, qty, unit_price_cents, amount_cents, kind (`subscription`|`usage`|`license`|`credit`|`tax`|`discount`), ref jsonb.
- `payments` — id, invoice_id, org_id, gateway (`stripe`|`moyasar`|`hyperpay`|`paytabs`|`manual`|`wallet`), gateway_ref, status, amount_cents, currency, method jsonb, error, created_at.
- `payment_methods` — org_id, gateway, gateway_ref, brand, last4, exp, default_flag.
- `tax_rules` — country, region?, rate_bps, kind (`vat`|`gst`|`sales`), inclusive.
- `coupons` — mirror of promo but scoped to subscriptions.
- `usage_events` — id, org_id, metric (`active_users`|`active_devices`|`api_requests`|`storage_bytes`|`stream_bytes`|string), quantity, occurred_at, source, dedupe_key unique.
- `usage_daily` — org_id, metric, day, quantity (rollup).
- `api_keys` — id, org_id, name, prefix, hash, scopes text[], expires_at, last_used_at, last_used_ip, revoked_at, created_by.
- `api_request_log` — key_id?, org_id?, method, path, status, ms, ip, ua, at (partitioned by day via index).
- `webhook_endpoints` — id, org_id, url, secret, events text[], active, created_at.
- `webhook_deliveries` — id, endpoint_id, event, payload jsonb, status, attempt, next_attempt_at, response_status, response_body, delivered_at.
- `webhook_events` — id, org_id, kind, payload jsonb, created_at (source of truth; deliveries fan out).

Extend enums / helpers:
- `app_role` gains `reseller_owner`, `reseller_staff`, `billing_admin`, `api_client`.
- SECURITY DEFINER helpers: `current_org(uid)`, `is_org_member(uid, org)`, `org_ancestors(org)`, `can_bill(uid, org)`, `has_scope(key_hash, scope)`.
- Ownership rule for RLS: rows readable by org members + all ancestor org members up to platform.

All new public tables get `GRANT SELECT,INSERT,UPDATE,DELETE ON … TO authenticated; GRANT ALL … TO service_role;` (no anon), then RLS enabled and policies scoped via `is_org_member` / `org_ancestors`.

## 2. Server modules (splitting rule respected)

- `src/lib/tenancy.server.ts` — `resolveTenant(ctx)`, `assertTenantAccess`, `withOrg(orgId, fn)`, ancestor walk.
- `src/lib/resellers.functions.ts` — CRUD orgs, member management, balance top-up, credit-limit change, commission config, hierarchy tree.
- `src/lib/pricing.server.ts` + `pricing.functions.ts` — `resolvePrice(pkg, org, region, at)` walking org → ancestor → default; discount/margin/promo application; `previewOrder`.
- `src/lib/orders.functions.ts` — reseller license purchase → deducts wallet or opens invoice → on paid, calls existing licensing to mint licenses/codes. All actions audited.
- `src/lib/billing.functions.ts` — plans CRUD, subscribe/change/cancel, trial start, coupon apply, upcoming invoice preview, dunning state machine.
- `src/lib/invoices.server.ts` — number sequence per tenant, line assembly, tax via `tax_rules`, PDF via lazy-loaded `pdfkit` in Worker (fallback to HTML→PDF using `@react-pdf/renderer`). Actual choice: `@react-pdf/renderer` (Worker-safe, pure JS).
- `src/lib/payments.server.ts` — gateway adapter interface `PaymentGateway { createIntent, capture, refund, verifyWebhook, syncMethods }`; adapters: `stripe.ts`, `moyasar.ts`, `hyperpay.ts`, `paytabs.ts`, `wallet.ts`, `manual.ts`. Only interface + wallet + manual land now; other adapters are stubbed with signed-off TODO markers and env-guarded so the platform ships without keys.
- `src/lib/usage.functions.ts` — `recordUsage(metric, qty, dedupeKey)`, nightly rollup fn, meter query. Middleware helper `meterApiRequest()` inserts an `api_requests` event on every v1 hit.
- `src/lib/api-keys.functions.ts` — create (returns plaintext once), list, rotate, revoke; scope check helper.
- `src/lib/webhooks.server.ts` — enqueue → deliver with HMAC-SHA256 signature (`X-Nova-Signature`), retries at 30s / 2m / 15m / 1h / 6h / 24h with jitter (exponential backoff), delivery log.
- `src/lib/webhooks.functions.ts` — endpoint CRUD + test-send.
- `src/lib/rest-auth.server.ts` — unified auth for `/api/v1/*`: bearer JWT (user session) OR `Authorization: Bearer nvk_…` API key. Loads `{ orgId, scopes, actor }` into a request context. Rate limit per key/IP via existing `rate-limit.server.ts`, per-scope quotas.
- `src/lib/openapi.ts` — hand-authored OpenAPI 3.1 doc built from a small Zod-to-OpenAPI registry; exposed at `/api/v1/openapi.json` and rendered at `/api/v1/docs` (Scalar viewer via CDN link).

## 3. REST API surface (`src/routes/api/v1/*`)

Every route uses `rest-auth`, tenant isolation, Zod input, standard pagination (`?page&per_page&sort&filter[...]`), cursor optional, envelope `{ data, meta: { page, per_page, total, next_cursor? } }`.

Routes:
- `api/v1/openapi.json.ts`, `api/v1/docs.tsx`
- `api/v1/auth/token.ts` (POST — exchange refresh / login)
- `api/v1/me.ts`
- `api/v1/orgs.ts`, `orgs.$id.ts`, `orgs.$id.members.ts`, `orgs.$id.balance.ts`
- `api/v1/resellers.ts`, `resellers.$id.tree.ts`
- `api/v1/packages.ts`, `packages.$id.pricing.ts`
- `api/v1/licenses.ts`, `licenses.$id.ts`, `licenses.$id.suspend.ts`, `licenses.$id.reassign.ts`, `licenses.$id.renew.ts`
- `api/v1/activations.ts` (POST redeem, GET list)
- `api/v1/devices.ts`, `devices.$id.revoke.ts`
- `api/v1/users.ts`, `users.$id.ts`
- `api/v1/billing/plans.ts`, `billing.subscriptions.ts`, `billing.subscriptions.$id.ts`
- `api/v1/billing.invoices.ts`, `billing.invoices.$id.ts`, `billing.invoices.$id.pdf.ts`
- `api/v1/billing.payments.ts`, `billing.payment-methods.ts`
- `api/v1/billing.usage.ts` (POST push, GET query)
- `api/v1/webhooks/endpoints.ts`, `webhooks.deliveries.ts`

Public webhook receivers (no auth wall; verify signature in-handler): `src/routes/api/public/webhooks/{stripe,moyasar,hyperpay,paytabs}.ts`.

Cron-invocable: `src/routes/api/public/cron/{dunning,usage-rollup,webhook-retry,trial-expiry}.ts`, each guarded by `CRON_SECRET` header.

## 4. Admin & portal routes

Admin (extends existing `/admin`):
- `/admin/resellers` — hierarchy tree, drill-in, edit balance/credit/pricing.
- `/admin/pricing` — package × org matrix with overrides.
- `/admin/billing` — plans, coupons, tax rules.
- `/admin/invoices` — list/detail/void/refund.
- `/admin/payments` — list, retry, reconcile.
- `/admin/usage` — metrics explorer + top-N consumers.
- `/admin/api-keys` — platform keys.
- `/admin/webhooks` — global endpoints + deliveries.
- `/admin/finance` — MRR/ARR/churn/failed-payments/revenue-by-package/revenue-by-reseller with Recharts.

Reseller portal (new `/reseller` layout under `_authenticated`):
- `/reseller` dashboard, `/reseller/customers`, `/reseller/licenses`, `/reseller/orders`, `/reseller/pricing`, `/reseller/wallet`, `/reseller/api-keys`, `/reseller/webhooks`.

Customer portal (new `/portal` layout):
- `/portal/subscription`, `/portal/licenses`, `/portal/invoices`, `/portal/payment-methods`, `/portal/usage`, `/portal/upgrade`.

Nav additions in `src/routes/admin.tsx`: Resellers, Pricing, Billing, Invoices, Payments, Usage, API Keys, Webhooks, Finance.

## 5. RBAC & tenant isolation

- Extend `capabilitiesFor` in `src/lib/auth-utils.ts`: `canManageResellers`, `canManageBilling`, `canManageApiKeys`, `canManageWebhooks`, `canViewFinance`, `canImpersonateCustomer`.
- Every server fn: `.middleware([requireSupabaseAuth])` → `assertCapability` OR `assertTenantAccess(orgId)`.
- Every `/api/v1/*` handler: `authenticate()` → `authorizeScope(scope)` → `assertTenantAccess(targetOrg)`.
- RLS policies enforce ancestor-walk visibility; server fns never trust `orgId` from input without cross-check.

## 6. Webhooks / retry engine

- `webhookDeliveries.next_attempt_at` scanned by `/api/public/cron/webhook-retry` (every 5 min via user's scheduler / pg_cron). Backoff sequence above with ±20% jitter, max 8 attempts.
- Signature: `t=<unix>,v1=<hex hmac(secret, "t.body")>` in `X-Nova-Signature`.
- Delivery timeouts 10s; log status + body (truncated).

## 7. Billing engine details

- Money always cents + ISO currency; conversions via `tax_rules` (no FX yet — flagged for later).
- Invoice numbering: `INV-{orgSlug}-{yyyymm}-{seq}` with per-org sequence table.
- Dunning: `open` → 3 retries at +1d/+3d/+7d → `past_due` → cancel or downgrade per plan config.
- Usage-based lines: at period close, roll `usage_daily` → invoice line per metric using plan's `usage_components`.
- Refunds go through gateway adapter then reverse ledger + credit note invoice.

## 8. PDF invoices

`@react-pdf/renderer` in a server fn returning `application/pdf`. Cached to Supabase storage bucket `invoices/` (created in migration) with signed URLs; regeneration allowed until `paid`.

## 9. Security & audit

- Every mutating REST + fn call → `writeAudit` (extends existing helper with `api_key_id`, `gateway_ref`).
- `api_request_log` written by rest-auth middleware.
- Webhook signature verification failure → `security_events` `suspicious`.
- Cross-tenant probe test suite (see testing).

## 10. Testing (`bunx vitest`)

`src/lib/__tests__/`:
- `rest-auth.test.ts` — JWT + API key + scope enforcement + rate limit.
- `licenses-api.test.ts` — CRUD, suspend, reassign, renew.
- `billing-flow.test.ts` — subscribe → invoice → pay → renew → cancel.
- `payment-webhooks.test.ts` — signed Stripe/Moyasar mock payloads → invoice state transitions.
- `renewal.test.ts` — dunning transitions.
- `reseller-ops.test.ts` — order → license mint → wallet debit; commission credit to parent.
- `rate-limit.test.ts` — bucket exhaustion returns 429 + `Retry-After`.
- `permissions.test.ts` — every capability negative-tested; unauthenticated → 401, wrong-scope → 403.
- `tenant-isolation.test.ts` — automated cross-tenant pentest: create two orgs, iterate all REST endpoints, assert 404/403 on foreign IDs and no rows leak in list endpoints.
- `usage-metering.test.ts` — dedupe key idempotency, rollup correctness.
- `webhook-retry.test.ts` — backoff schedule + max attempts.

All server fns unit-tested against a fake supabase client (existing pattern).

## 11. Future compatibility

- REST API is the sole write surface; admin/portal UIs consume the same server fns (which internally reuse the same domain logic). Mobile/desktop/ERP/CRM/POS/marketplace clients hit `/api/v1/*` with an API key and get identical behavior.
- Gateway adapter interface + white-label branding fields on `organizations` (logo, primary color, domain) unblock white-label deploys without redesign.
- Usage metering is wired from day one; UI exposes subscription billing first, usage-based lines flip on via plan `usage_components` config alone.

## 12. Rollout order (each landing green)

1. Migration + tenancy helpers + RBAC extensions + audit hook additions.
2. Resellers module + `/admin/resellers`.
3. Pricing engine + `/admin/pricing` + reseller pricing view.
4. Wallet + orders + reseller license purchase flow.
5. Billing plans + subscriptions + coupons.
6. Invoices + PDF + `/admin/invoices`, `/portal/invoices`.
7. Payment gateway interface + wallet/manual + webhook receivers scaffolded.
8. Usage metering + rollup cron.
9. REST API v1 (all routes) + OpenAPI + docs page + API keys.
10. Webhook delivery engine + retry cron + `/admin/webhooks`.
11. Reseller portal + Customer portal.
12. Finance dashboard.
13. Vitest suite green; cross-tenant pentest green.

## Technical notes

- Every new public table: CREATE → GRANT → RLS → POLICY.
- No hardcoded prices, currencies, tax rates, or gateway URLs — all config in tables/env.
- No new Supabase Edge Functions. All server logic via `createServerFn` or TSS server routes.
- `supabaseAdmin` used only for privileged writes, always loaded inside handlers.
- Payment gateway adapters implement one interface; adding a new gateway = new adapter file + row in a `gateways` table, no core changes.
- Existing playback/auth/licensing/admin surfaces untouched except for additive nav links and audit hook wiring.

This is a large phase — implementation will land across many turns. Approve and I'll execute steps 1–13 in order, reporting after each.
