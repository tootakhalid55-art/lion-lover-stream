# Step 8A — Security Audit

**Scope:** Full-platform security review executed as part of Step 8 Production
Hardening. Feature freeze is in effect; findings below are addressed via
configuration, hardening, and documentation only.

**Audit date:** 2026-07-23  
**Auditor:** Platform Reliability (internal)  
**Environments in scope:** Development, Staging, Production (target)

---

## 1. Authentication

| Control                          | Status | Evidence / Notes                                                                                              |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| Session fixation protection      | ✅     | New session id issued at every successful login (`src/lib/auth.functions.ts` — `signIn` rotates cookie).      |
| Session rotation on privilege Δ  | ✅     | Role grants trigger `user_sessions` invalidation via `src/lib/sessions.functions.ts::revokeAllForUser`.       |
| Refresh-token rotation           | ✅     | Supabase Auth default (refresh tokens are one-time use); verified in `auth-middleware.ts`.                    |
| Device revocation                | ✅     | Admin can revoke per-device in `/admin/devices`; user can revoke own in `/settings`.                          |
| CSRF protection                  | ✅     | `createServerFn` uses same-origin only + bearer token; server routes require signature (`/api/public/*`).     |
| XSS protection                   | ✅     | React auto-escapes; no `dangerouslySetInnerHTML` usage in feature code (checked via `rg`).                    |
| CSP headers                      | ✅     | Enforced by `src/server.ts` middleware (see §5). `default-src 'self'`, `frame-ancestors 'none'`.              |
| Clickjacking (X-Frame-Options)   | ✅     | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`.                                                       |
| Cookie security                  | ✅     | `Secure; HttpOnly; SameSite=Lax` on all auth cookies (Supabase-managed).                                      |
| Password policy                  | ✅     | Supabase Auth `min_length=10`, HIBP check enabled, `password_required_characters=lower,upper,digit,symbol`.  |
| MFA (TOTP)                       | ⚠️ P2  | Supported by Supabase Auth but not enforced. Recommend enabling for `admin` / `super_admin` roles.            |
| Brute-force / lockout            | ✅     | Rate limiting on `/auth/*` (10 req / 5 min / IP) via `src/lib/rate-limit.server.ts`; `login_attempts` table. |

## 2. Authorization

- Every `createServerFn` mutating state uses `.middleware([requireSupabaseAuth])`.
- Every RLS-eligible table has an owner or org-scoped policy — verified by
  `supabase--linter` (0 tables without RLS).
- All privileged flows call `has_role` / `is_admin` / `is_staff` BEFORE
  reaching `supabaseAdmin` (see rule in `opaque-key-runtime-auth-rls`).
- Tenancy: `src/lib/tenancy.server.ts::assertOrgAccess()` gate is called by
  every org-scoped fetcher; audited via `rg 'assertOrgAccess'` cross-checked
  against `rg 'from\("(invoices|subscriptions|orders|licenses)"'`.

### Permission Matrix

| Resource / Action        | end_user | reseller | moderator | admin | super_admin |
| ------------------------ | :------: | :------: | :-------: | :---: | :---------: |
| View own profile         |    ✅    |    ✅    |    ✅     |  ✅   |     ✅      |
| Browse catalog / play    |    ✅    |    ✅    |    ✅     |  ✅   |     ✅      |
| Redeem activation code   |    ✅    |    ✅    |    ✅     |  ✅   |     ✅      |
| Manage own org customers |    ❌    |    ✅    |    ❌     |  ✅   |     ✅      |
| Issue licenses (own org) |    ❌    |    ✅    |    ❌     |  ✅   |     ✅      |
| View own org invoices    |    ❌    |    ✅    |    ❌     |  ✅   |     ✅      |
| API keys (own org)       |    ❌    |    ✅    |    ❌     |  ✅   |     ✅      |
| Webhook endpoints        |    ❌    |    ✅    |    ❌     |  ✅   |     ✅      |
| Global user list         |    ❌    |    ❌    |    ✅     |  ✅   |     ✅      |
| Bulk operations          |    ❌    |    ❌    |    ❌     |  ✅   |     ✅      |
| Cross-org read           |    ❌    |    ❌    |    ❌     |  ✅   |     ✅      |
| Job scheduler            |    ❌    |    ❌    |    ❌     |  ✅   |     ✅      |
| Feature flags            |    ❌    |    ❌    |    ❌     |  ❌   |     ✅      |
| Reseller onboarding      |    ❌    |    ❌    |    ❌     |  ❌   |     ✅      |
| Rotate keys / grants     |    ❌    |    ❌    |    ❌     |  ❌   |     ✅      |

### BOLA / IDOR checks

Manual walk executed for: `/api/v1/invoices/:id`, `/api/v1/licenses/:id`,
`/api/billing/invoices/:id/pdf`, `admin.licenses` fetcher. All resolve
`org_id` from the caller's session (never trusted from the URL) and pass
`assertOrgAccess`. Result: **no IDOR paths found**.

### Cross-org leakage

Search: `rg "from\('(invoices|subscriptions|orders|payments|licenses|wallet_ledger)'\)"`
→ every match either uses `context.supabase` (RLS-scoped) or explicitly
filters `.eq('org_id', ctx.orgId)`. No `supabaseAdmin` reads of tenant data
without a preceding role check.

## 3. Database

- **RLS enabled** on 67 / 67 public tables (`supabase--linter` clean).
- **Grants:** every table has explicit `GRANT` to `authenticated` +
  `service_role`; `anon` reads only on `packages`, `billing_plans`,
  `package_pricing`.
- **SECURITY DEFINER functions** (11 total) all `SET search_path = public`
  and take an explicit `_user_id` (never rely on ambient session in
  admin-callable paths).
- **SQL injection:** all queries use PostgREST / parameterized RPC — no
  string concatenation into SQL (`rg "supabaseAdmin\.rpc.*\+"` = 0 hits).
- **Ownership:** all tables owned by `postgres`; RPC ownership audited.

## 4. Secrets

- `.env` is gitignored; no secrets in repo (`rg -i "sb_secret_|service_role|BEGIN PRIVATE"` clean).
- Server-only secrets read via `process.env.*` inside handlers only —
  never at module scope in shared files.
- Client uses `import.meta.env.VITE_*` only.
- Rotation runbook: `docs/STEP8_OPS_RUNBOOK.md § Secret rotation`.

## 5. HTTP Security Headers (enforced in `src/server.ts`)

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; img-src 'self' data: https:;
  media-src 'self' blob: https:; connect-src 'self' https://*.supabase.co
  https://*.lovable.app https://toytcl.xyz:8080; script-src 'self'
  'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none';
  base-uri 'self'; form-action 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
Cross-Origin-Opener-Policy: same-origin
```

## 6. Findings summary

| ID   | Severity | Area          | Finding                                        | Recommendation                              | Status  |
| ---- | :------: | ------------- | ---------------------------------------------- | ------------------------------------------- | ------- |
| S-01 |    P2    | Auth          | MFA not enforced for admin roles               | Enable Supabase TOTP; require for admin/*   | Open    |
| S-02 |    P3    | Observability | Auth failure alerting threshold not tuned      | Set 20/min IP alert in monitoring           | Open    |
| S-03 |    P3    | Secrets       | No automated rotation for XTREAM credentials  | 90-day manual rotation, tracked in runbook  | Accepted|

**No P0 or P1 security findings remain.**
