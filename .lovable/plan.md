# Nova TV — Admin-Managed User Licensing System

Replace open access with a commercial-grade auth model: only an admin can create accounts; users log in with username + password, bound to one device and one session, with expiration dates and account status.

Backend: Lovable Cloud (Postgres + Auth + server functions). The existing Xtream streaming layer is untouched — we only add a gate in front of it.

## Scope (Phase 1 — ship now)

Ships a working, secure, commercial-grade core. Phases 2–3 layer on advanced admin polish and "future-ready" hooks without rework.

### Phase 1
1. **Cloud + schema**
   - Enable Lovable Cloud.
   - Tables (all with RLS + explicit grants):
     - `profiles` (linked to `auth.users`): `username`, `display_name`, `email`, `phone`, `status` (`active|suspended|expired|disabled|locked`), `expires_at`, `activated_at`, `notes`, timestamps.
     - `user_roles` + `app_role` enum (`super_admin`, `admin`, `moderator`) + `has_role()` security-definer fn.
     - `user_devices`: one row per account = the bound device (`device_id`, `device_name`, `os`, `browser`, `ip`, `last_seen`).
     - `user_sessions`: active session token hash, device_id, ip, ua, `created_at`, `expires_at`, `revoked_at`.
     - `login_attempts`: for rate-limiting + lockout.
     - `audit_logs`: every admin action (`actor_id`, `action`, `target_user_id`, `meta`, `ip`, `ts`).
   - Trigger creates a `profiles` row on `auth.users` insert.
   - No public signup: disable email confirmations UX-side; the admin creates users via Auth Admin API from a privileged server fn.

2. **Server functions (`createServerFn`, `requireSupabaseAuth` where relevant)**
   - `adminCreateUser` (super_admin/admin): generate `nova#####` username + strong password (returned once, in the response, for the admin to hand off), create `auth.users` via `supabaseAdmin`, insert profile + role, log audit.
   - `adminListUsers`, `adminUpdateUser`, `adminSuspend`, `adminReactivate`, `adminDelete`, `adminResetPassword`, `adminResetDevice`, `adminForceLogout`, `adminSetExpiration(duration)`.
   - `login(username, password, deviceFingerprint)`:
     - rate-limit by IP + username (token bucket already in repo);
     - resolve username → email, call Supabase password sign-in server-side;
     - enforce status + `expires_at` (auto-flip to `expired`);
     - device check: if no bound device → bind; if bound and mismatch → reject with "already active on another device";
     - revoke prior sessions, insert new `user_sessions` row, set HttpOnly encrypted cookie.
   - `logout`, `me`.
   - `adminStats` for dashboard totals.

3. **Auth gating**
   - `_authenticated/route.tsx` layout gates the whole app (home, browse, watch, settings…) via `me` server fn; unauthenticated → `/login`.
   - `_admin/route.tsx` layout additionally requires `super_admin|admin|moderator` via `has_role`.
   - Move existing app routes under `_authenticated/`.

4. **Screens**
   - `/login` — username + password only, no signup link, generic error messages, lockout notice.
   - `/admin` — dashboard: totals (users, active, online, expired, suspended, devices, sessions, new today).
   - `/admin/users` — table with search, status filter, columns: username, status, expires, device, last login, online dot; row actions: edit, reset pw, reset device, force logout, suspend/reactivate, delete.
   - `/admin/users/new` — auto-generated username + password (editable), duration select (1/7/30/90/180/365/Lifetime), copy-to-clipboard on save.
   - `/admin/users/$id` — full profile, device info, session list, login history, audit trail.

5. **Security**
   - Argon2/bcrypt handled by Supabase Auth for passwords.
   - Rate limit login (per IP + per username), lock account after N failures (configurable, default 5) for 15 min.
   - CSRF: same-site strict on session cookie; server fns are same-origin.
   - HttpOnly, Secure, SameSite=strict session cookie via `useSession`.
   - Audit every admin mutation.

### Phase 2 (follow-up, no schema break)
- Moderator read-only view polish, bulk actions, CSV export, richer login history charts, notifications on suspicious login.

### Phase 3 (future-ready hooks — schema stubs only in P1)
- `subscription_plans`, `licenses`, `activation_codes`, `resellers` tables created empty with RLS so later features slot in without migration churn.

## Technical notes

- Username is stored on `profiles.username` (unique, lowercased). Auth uses a synthetic email `${username}@users.novatv.local` so we can reuse Supabase's password + session machinery without exposing email to the user.
- Device fingerprint: stable hash of `navigator.userAgent + language + screen + a persistent random id in localStorage`. Sent from client on login; server also records IP + UA server-side.
- "Online" = has a `user_sessions` row with `last_seen` within the last 5 min (updated on every authenticated server fn via middleware).
- `supabaseAdmin` is only loaded inside handler bodies of privileged fns, after `has_role` check on `context.supabase`.
- All new tables get explicit `GRANT`s per project rules; policies scoped to `auth.uid()` for self-reads, and `has_role(auth.uid(),'admin'|'super_admin')` for admin reads/writes.
- Existing Xtream layer, player, and streaming proxy are untouched.

## Out of scope for this plan
- Payments, plan purchase UI, reseller portal, activation-code redemption UI (schema stubs only).
- Email/SMS delivery of credentials (admin copies from the create-user screen).

Confirm and I'll implement Phase 1 end to end.
