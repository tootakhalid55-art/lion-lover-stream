# Sub-phase 2B — Administration & Security Center

Big scope, so I'll ship it as one migration + several focused server-fn modules + admin pages, wired to the existing `/admin` layout. Everything RBAC-gated, every mutation audited, every list exportable.

## 1. Database migration (single call)

New / altered tables:
- `user_devices` — add `name`, `device_type`, `browser`, `os`, `country`, `region`, `trusted_at`, `blocked_at`, `first_seen_at`, `last_activity_at`.
- `user_sessions` — add `country`, `revoked_at`, `revoked_by`, `revoked_reason`.
- `notifications` — id, user_id (nullable = broadcast to admins), kind, title, body, meta jsonb, read_at, created_at.
- `security_events` — id, user_id (nullable), kind (`failed_login`|`successful_login`|`password_change`|`package_activated`|`license_activated`|`device_registered`|`suspicious`|`account_locked`|`session_revoked`|`device_revoked`|`new_device`|`bulk_op`), severity, ip, ua, country, meta jsonb, created_at. Indexed on (kind, created_at desc).
- `system_health_snapshots` — id, taken_at, db_ok, api_latency_ms, active_sessions, failed_jobs, meta jsonb. (For history charts.)
- Extend `app_role` enum: add `support`, `auditor`, `readonly` (keep existing `super_admin`, `admin`, `moderator`).
- New security-definer helpers: `has_any_role(_uid, _roles[])`, `can_manage_users(_uid)`, `can_view_only(_uid)`.
- RLS: admins/support can read all events/notifications; users see only their own.
- GRANTs for every new table (authenticated + service_role).

## 2. Server modules

Splitting rule respected (helpers in `.server.ts`, handlers in `.functions.ts`).

- `src/lib/rbac.server.ts` — `assertRole(ctx, roles[])`, `capabilities(uid)` returning `{ canManageUsers, canManageLicenses, canRevokeDevices, canBulk, canExport, canViewSecurity, canViewAudit, canManageSystem, readOnly }`.
- `src/lib/audit.server.ts` — `writeAudit({ actor, action, target, before, after, ip, ua })` used by every mutating fn; also mirrors relevant entries into `security_events`.
- `src/lib/devices.functions.ts` — `listDevices({ userId?, query?, status?, trusted?, page })`, `renameDevice`, `trustDevice`, `untrustDevice`, `revokeDevice`, `forceLogoutDevice` (kills sessions on that device), `bulkRevokeDevices`.
- `src/lib/sessions.functions.ts` — `listSessions({ userId?, state: active|expired|all })`, `terminateSession`, `terminateOtherSessions(userId)`, `forceReauth(userId)` (bumps a `reauth_after` on profile, gate checks it), `myActiveSessions` (self).
- `src/lib/security.functions.ts` — `listSecurityEvents({ kind?, severity?, userId?, from?, to?, query?, page })`, `securityKpis(range)`, `lockAccount`, `unlockAccount`. Threshold job: `finalizeLogin` (already exists) will call `recordFailedLogin` → auto-lock at N failures/window.
- `src/lib/bulk.functions.ts` — `bulkAssignLicense`, `bulkChangePackage`, `bulkActivate`, `bulkSuspend`, `bulkRevokeDevices`, plus a paired `previewBulk*` that returns per-target effect + validation errors (no writes).
- `src/lib/notifications.functions.ts` — `listMyNotifications`, `markRead`, `markAllRead`, `adminBroadcast` (super_admin), + internal `emitNotification(...)` helper used by device/license/security flows.
- `src/lib/export.server.ts` + server routes `src/routes/api/admin/export/$dataset.$format.ts` — datasets: users, packages, licenses, devices, sessions, security. Formats: csv, xlsx. Auth via bearer (same as protected server fns) inside handler; passes filters from query string. Uses `xlsx` npm package for xlsx.
- `src/lib/dashboard.functions.ts` — `dashboardV2({ range })` returning KPIs + time-series (daily activations, new users, logins, package distribution).
- `src/lib/system-health.functions.ts` — `systemHealth()` returning db ping, api latency, active-session count, cache stats, failed-jobs (from `security_events` kind=`job_failed`), background-task list (currently: cache warmers, heartbeats), storage usage (Supabase storage — return N/A when unavailable).

## 3. Admin routes (new)

All under existing `/admin` layout; nav grows.

- `/admin/devices` — table with filter chips (all / trusted / blocked / online), per-row menu (Rename, Trust, Revoke, Force Logout). Drawer shows full detail.
- `/admin/sessions` — tabs (Active / Expired), filter by user, actions per row + bulk toolbar.
- `/admin/security` — tabs: **Events**, **Failed Logins**, **Locks**. Filter + search. Severity color chips.
- `/admin/bulk` — pick target set (users/devices) via multi-select, pick action, **Preview** modal shows diff, **Confirm** writes.
- `/admin/audit` — read-only audit log with actor, action, before/after JSON diff, IP, device.
- `/admin/system` — System Health Dashboard: DB, latency, active sessions, cache, jobs, background tasks, API perf sparkline (30 min).
- `/admin/notifications` — inbox for the current admin + broadcast composer (super_admin only).
- Update `/admin` overview → **Dashboard v2** with KPI cards + Recharts (line: activations 30d, area: new users 30d, bar: logins 24h, donut: package distribution). I'll add `recharts` if not already installed.

Header nav additions: Devices, Sessions, Security, Audit, Bulk, System, plus a bell icon for notifications.

## 4. RBAC enforcement

- `src/lib/rbac.server.ts` gates every server fn.
- `src/hooks/use-capabilities.ts` fetches `capabilities()` once, caches with react-query.
- Admin routes hide nav links and disable actions the caller lacks. Server always re-checks — client hiding is UX only.
- Roles matrix:
  - `super_admin`: everything, incl. bulk + broadcast + resellers (2C).
  - `admin`: everything except role changes to admins, resellers, broadcast.
  - `support`: read all, revoke device, terminate session, reset password. No delete/bulk destructive.
  - `auditor`: read all incl. audit + security. No writes.
  - `readonly`: read own scope + dashboards. No security/audit.

## 5. Notifications wiring

Emit on: new device registration (`finalizeLogin` new fingerprint), license/package expiry (checked lazily by a light server fn triggered by dashboard load — good enough without cron; a real cron can plug in later), failed-login threshold hit, account locked, session revoked. Delivered in-app (bell + `/admin/notifications`); email hook is a no-op unless mail connector is added.

## 6. Testing

Add `bunx vitest` tests under `src/lib/__tests__/`:
- `rbac.test.ts` — matrix of role vs. capability.
- `audit.test.ts` — every mutating fn writes an audit row + before/after.
- `devices.test.ts` — revoke, trust flow, force-logout kills sessions.
- `sessions.test.ts` — terminate, terminate-others, force-reauth.
- `bulk.test.ts` — preview vs. execute; partial failures reported; audit rows per target.
- `licensing-assign.test.ts` — bulk license assignment side effects.
- `export.test.ts` — CSV headers + row count for each dataset; xlsx opens.
- `permissions.test.ts` — unauthorized caller gets 403 and no writes/audit rows.

Server fns are unit-tested with a mocked `supabase` client (existing pattern where present; otherwise a thin fake) to avoid needing a live DB in CI.

## 7. Rollout inside 2B

Order I'll actually implement, each landing green before the next:

1. Migration + RBAC helpers + audit helper (foundation).
2. Devices + Sessions server fns and pages.
3. Security Center + Notifications + auto-lock in `finalizeLogin`.
4. Bulk ops (preview + execute) + Bulk page.
5. Export routes + "Export" button on every list.
6. Dashboard v2 + System Health page.
7. Audit trail page.
8. Vitest suite; make everything green.

## Technical notes

- Every new table follows CREATE → GRANT → RLS → POLICY.
- All mutating server fns: `.middleware([requireSupabaseAuth])` → `assertRole` → do work → `writeAudit` → `emitNotification` where relevant.
- Export routes live at `/api/admin/export/*` (NOT `api/public`) and validate bearer inside the handler.
- xlsx uses the `xlsx` package (Worker-safe, pure JS).
- Recharts added if missing.
- No changes to existing playback/backend logic.

Approve and I'll execute steps 1–8 in order.
