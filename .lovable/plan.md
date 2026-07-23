# Phase 2 – Professional Auth & License Management

Phase 1 already gave us auth, single-device binding, admin CRUD, audit logs, and dashboard stats. Phase 2 turns that into a commercial licensing system. It is far too large for one shot without regressions, so I'll ship it in **three self-contained sub-phases**, each independently useful and testable.

Everything stays modular under `src/lib/<module>.functions.ts` + `src/routes/admin.<module>.tsx` (Authentication / Licensing / Devices / Sessions / Packages / Resellers / Activity / API / Billing).

---

## Sub-phase 2A — Packages, Licenses & Multi-Device (core)

New tables (migration):
- `packages` — name, tier (`trial`|`monthly`|`quarterly`|`semi_annual`|`annual`|`lifetime`|`custom`), duration_days (null=lifetime), max_devices, max_sessions, simultaneous_streams, allow_download, allow_recording, allowed_features (jsonb), allowed_categories (jsonb), price_cents, currency, is_active
- `licenses` — user_id, package_id, license_key (unique `NOVA-YYYY-XXXX-XXXX-XXXX`), license_type (`trial`|`paid`|`lifetime`|`comp`), activated_at, expires_at, auto_renew, status (`active`|`expired`|`revoked`|`pending`), issued_by
- `activation_codes` — code (unique `NOVA-XXXX-XXXX-XXXX`), package_id, duration_override_days, uses_allowed, uses_count, expires_at, created_by, notes
- Seed default packages (Trial/Basic/Family/Premium/Lifetime).
- Add `package_id` to `profiles` (nullable) and enforce max_devices in `finalizeLogin`.

Server module `src/lib/licensing.functions.ts`:
- `listPackages`, `upsertPackage`, `deletePackage`
- `listLicenses(filter)`, `issueLicense`, `renewLicense(id, days|packageId)`, `revokeLicense`
- `listActivationCodes`, `createActivationCodes(count, packageId, ...)`, `revokeActivationCode`, `redeemActivationCode(code)` (public — creates account + license)
- Helpers: `generateLicenseKey()`, `generateActivationCode()` (cryptographic)

Update `adminCreateUser` + Create modal to pick a package. Update `finalizeLogin` device check to `max_devices` (list vs. single).

Admin UI:
- `/admin/packages` — table + editor (all package fields)
- `/admin/licenses` — table with filters (status, package, expiring soon), one-click renew, revoke
- `/admin/codes` — activation-code generator (bulk N), CSV download, revoke
- `/redeem` (public route) — user redeems code → creates account → shows credentials
- Update `/admin/users` — package column + change package action

---

## Sub-phase 2B — Devices, Sessions, Activity, Security, Bulk ops, Export

Migration: add columns to `user_devices` (`device_type`, `app_version`, `country`, `first_login_at`, `blocked_at`, `name`) and `user_sessions` (`country`). Add `password_history` table (user_id, password_hash, changed_at) — Supabase Auth stores the current hash; we track only the last N *change events* (timestamp + a short salted digest) for expiry/history UI, not full replay.

Server modules:
- `src/lib/devices.functions.ts` — listDevices(userId?), renameDevice, blockDevice, unblockDevice, removeDevice, forceReregister
- `src/lib/sessions.functions.ts` — listSessions(userId?, activeOnly), terminateSession, terminateAllForUser, terminateAllGlobal, mySessions (self), myLogoutAll
- `src/lib/security.functions.ts` — changeMyPassword (with strength check + brute-force lock), adminSetLockoutPolicy (config table), detectSuspiciousLogin (impossible-travel + new-country flag written to `audit_logs.meta`)
- Geo-IP: use `https://ipapi.co/{ip}/json/` server-side (no key, cached in memory). Graceful degradation if unavailable.
- Bulk actions in `src/lib/bulk.functions.ts` — extendSubscription, suspend, delete, resetPassword, resetDevices, forceLogout, assignPackage on a list of user ids
- CSV/Excel export in `src/lib/export.functions.ts` — returns a `Response` from server routes at `/api/admin/export/{users|licenses|devices|sessions|activity}.{csv|xlsx}` (server-route auth-gated with the caller's bearer). `xlsx` via `xlsx` npm package (bundled).

Admin UI:
- `/admin/devices` — global device list with filter + per-user drilldown
- `/admin/sessions` — active sessions, force-terminate individually or in bulk
- `/admin/activity` — filterable audit + login-attempt log (user, date range, action)
- `/admin/security` — lockout policy (max failed attempts, lock duration), password expiry days, HIBP toggle
- `/account/security` — end-user: change password (strength meter), view own sessions/devices, logout everywhere
- Bulk selection on `/admin/users` with the toolbar above

Dashboard v2 (`/admin`):
- Cards: Revenue (sum of paid licenses this month — placeholder = Σ package.price_cents on licenses issued), Expiring in 7d, Recently created, Recently active, Failed logins 24h, Suspended, Top active users, Top devices, Active streams (=active sessions with an open playback session — we'll approximate via `user_sessions.last_seen` within 60s)
- Charts (Recharts, already in stack if not I'll add): line — daily logins 30d; bar — new users 30d; donut — package distribution

---

## Sub-phase 2C — Resellers, REST API, Payments-ready hooks

Migration:
- `resellers` — user_id, credit_balance_cents, customer_limit, allowed_package_ids, notes
- `api_keys` — reseller/admin_id, key_hash, prefix, scopes (jsonb), last_used_at, revoked_at
- Roles enum extended: `reseller`

Reseller UI:
- `/admin/resellers` (super_admin only) — create reseller, credit top-up, package allowlist, customer limit
- `/reseller` — subset dashboard: their own users, licenses, codes; issuing consumes credit; cannot see other resellers or super-admin data (enforced via RLS + fn checks)

REST API (`src/routes/api/v1/*`):
- `POST /api/v1/users`, `DELETE /api/v1/users/:id`, `POST /api/v1/users/:id/suspend`, `POST /api/v1/users/:id/renew`, `POST /api/v1/users/:id/reset-device`, `GET /api/v1/users/:id`, `GET /api/v1/licenses/:key/validate`, `GET /api/v1/users/:id/sessions`
- Auth: `Authorization: Bearer nova_sk_...`; key hashed (SHA-256) and matched to `api_keys`; scopes enforced per endpoint. Rate-limited via existing `rate-limit.server`.
- `/admin/api-keys` — create/revoke keys, show once.

Billing scaffolding (`src/lib/billing.functions.ts` + `src/routes/api/public/webhooks/*`):
- `payment_intents` table (provider, provider_id, user_id, package_id, amount_cents, currency, status, meta)
- Provider adapters interface: `createCheckout(user, package)`, `handleWebhook(request)` — stubs for Stripe, PayPal, Apple Pay, Google Pay, Mada, STC Pay
- Webhook route validates signature (per provider), on `succeeded` calls shared `activateOrRenewLicense(user, package)` used by activation codes / admin renew / payment webhooks — one code path.
- Only Stripe stub gets a real signature check; others log and return 202 until keys are provided. Login-notification hook lives here (`onLicenseActivated`) but sends via email connector only if configured.

---

## What I'll defer and why

- **Email/SMS login notifications** actually delivered: needs a mail connector (Resend/SendGrid). I'll wire the hook and UI toggle; sending activates when the user connects an email provider — otherwise it's a no-op with an admin banner.
- **Real payment charging** for Stripe/PayPal/Apple/Google/Mada/STC — requires the user's merchant accounts + secrets. Scaffolding + webhook contract ships now; live keys unlock the flow.
- **Apple Pay / Google Pay** as first-party providers — normally ride on Stripe/Adyen; I'll expose them through the Stripe adapter's payment-request button rather than as separate integrations.

---

## Technical notes

- Every new table follows the required order: CREATE → GRANT (authenticated + service_role, no anon) → RLS → policies using `is_admin` / `is_staff` / owner. Reseller access via a `is_reseller_of(caller, target)` SECURITY DEFINER helper.
- All server fns keep to the `tanstack-serverfn-splitting` rule (helpers in `.server.ts`, handlers in `.functions.ts`).
- `assertAdmin`/`assertStaff`/`assertReseller`/`assertSuperAdmin` gates before any `supabaseAdmin` write.
- Query builders use the `.returns<T>()` pattern from `query-builder-type-performance` to keep typecheck fast.
- All new admin pages under the existing `/admin` layout; nav grows to include Packages / Licenses / Codes / Devices / Sessions / Activity / Resellers / API keys / Security.
- Client-side password-strength meter uses `zxcvbn-ts` (small, no network).

---

## Rollout order

I'll implement and verify **2A first**, then 2B, then 2C — each ends with a working preview and its own migration. Approving this plan means "go ahead with all three sub-phases in order"; if you want to stop after 2A or 2B just say so.
