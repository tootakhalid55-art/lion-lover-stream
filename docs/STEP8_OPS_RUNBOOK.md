# Step 8H — Operational Runbook

## Administrator Guide

- **Access:** admin routes at `/admin/*` gated by `admin` / `super_admin`
  role. Bootstrap the first super_admin via `NOVA_ADMIN_BOOTSTRAP_CODE`
  at `/bootstrap`.
- **Daily checks:** `/admin` dashboard, `/admin/billing/observability`,
  `/admin/jobs`, `/admin/system` (health).
- **Bulk changes:** `/admin/bulk` — always dry-run first.

## Deployment Guide

1. Merge PR to `main` → CI deploys Staging automatically.
2. Validate Staging via `scripts/smoke.sh` (auto-run) + manual QA.
3. Tag release: `git tag v1.2.3 && git push --tags`.
4. Approve production deploy in GitHub Actions.
5. Watch dashboards for 30 min after cutover.

## Upgrade Guide

- Migrations run automatically as part of deploy.
- Breaking DB changes require a two-phase deploy: (1) add column
  nullable + backfill, (2) enforce NOT NULL + drop old column.
- Rollback: revert the release tag and redeploy previous artifact —
  DB migrations are additive; contact SRE before any destructive rollback.

## Backup Guide

- Nightly automated (Supabase, 30-day retention).
- PITR available for 7 days.
- Weekly config snapshot to object storage (`scripts/backup-config.sh`).
- Verify: `scripts/backup-verify.sh` runs nightly and alerts on drift.

## Restore Guide

See `docs/STEP8_DR_RUNBOOK.md § Restore procedure`.

## Incident Response Guide

1. Acknowledge alert in PagerDuty within 5 min.
2. Open bridge in `#ops-incident`, assign IC.
3. Classify severity (P1 = customer-visible outage; P2 = degraded; P3 = internal).
4. Post status to `status.nova-tv.app` for P1/P2.
5. Mitigate first, investigate second. Feature-flag or rollback allowed
   without change control during a P1.
6. Post-incident review within 5 business days; publish to
   `docs/postmortems/YYYY-MM-DD-slug.md`.

## Monitoring Guide

See `docs/STEP8_MONITORING.md`.

## Troubleshooting Guide

| Symptom                          | First check                                     | Runbook                          |
| -------------------------------- | ----------------------------------------------- | -------------------------------- |
| 5xx spike                        | `/admin/system` + application logs              | `runbooks/5xx-spike.md`          |
| Renewal failures rising          | `/admin/billing/observability`                  | `docs/STEP7_TRACE_GUIDE.md`      |
| Webhook backlog                  | `/admin/system` → webhook depth                 | `runbooks/webhook-backlog.md`    |
| Login errors                     | Auth logs; rate-limit table                     | `runbooks/auth-errors.md`        |
| Slow queries                     | Supabase → Reports → Slow queries               | `runbooks/db-slow.md`            |
| Backup verify failed             | `scripts/backup-verify.sh` stderr               | `docs/STEP8_DR_RUNBOOK.md`       |

## Secret rotation

Rotate every 90 days (or immediately on suspected compromise):

| Secret                     | Rotation procedure                                  |
| -------------------------- | --------------------------------------------------- |
| `SESSION_SECRET`           | Generate new, deploy — invalidates active cookies   |
| `SUPABASE_SERVICE_ROLE_KEY`| Rotate in platform; update secret store             |
| `LOVABLE_API_KEY`          | `ai_gateway_rotate_lovable_api_key` tool            |
| `XTREAM_DEFAULT_*`         | Coordinate with upstream provider before rotation   |
| Webhook signing secrets    | Rotate endpoint-by-endpoint with dual-accept window |
