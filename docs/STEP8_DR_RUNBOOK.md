# Step 8D — Disaster Recovery Runbook

## Objectives

| Target | Value  | Notes                                              |
| ------ | ------ | -------------------------------------------------- |
| RPO    | ≤ 5 m  | Continuous WAL shipping via Supabase PITR          |
| RTO    | ≤ 60 m | Restore + smoke on standby project                 |

## Backups

- **Automated:** Supabase daily physical backups (30-day retention) +
  continuous PITR window (7 days).
- **Application state:** stateless. All durable state is in Postgres +
  object storage.
- **Object storage:** none in use today (all media proxied). If storage
  buckets are added, enable versioning + weekly cross-region copy.
- **Configuration snapshot:** `scripts/backup-config.sh` exports env
  templates, feature flags, and RLS policies weekly to
  `s3://nova-tv-backups/config/`.

## Backup verification

- Nightly `scripts/verify-backup.sh` performs a metadata-only restore into
  a scratch project and asserts row counts on 10 canary tables. Failure
  triggers alert `BACKUP_VERIFY_FAILED` (PagerDuty P2).

## Restore procedure (full)

1. Announce incident in `#ops-incident` and open a bridge.
2. Freeze writes: put app into maintenance mode via `MAINTENANCE=1`
   env flag → returns 503 for all mutating routes.
3. Trigger PITR restore on Supabase to target timestamp.
4. Point the app at the restored project (`SUPABASE_URL`, keys) via the
   secret manager; redeploy.
5. Run `scripts/smoke.sh` against the restored instance (must pass 12/12).
6. Announce recovery, lift maintenance flag, monitor error rates for 30 min.

## Restore validation (drill)

Quarterly drill scheduled: last executed 2026-07-14, restored to
timestamp T-30m in **42 minutes wall-clock**. Drill report:
`docs/drills/2026-07-14.md`.

## Failure scenarios covered

Full matrix in `docs/STEP7_CHAOS_REPORT.md`. DR-specific entries:

| Scenario                              | Recovery                         |
| ------------------------------------- | -------------------------------- |
| Total region loss (Supabase)          | PITR restore in secondary region |
| Accidental table drop / mass update   | PITR to T-1m                     |
| Corrupted deployment                  | `git revert` + redeploy previous |
| Compromised admin credential          | Rotate + revoke all sessions     |
| Runaway job clogging worker           | `jobs.pause('<jobId>')` + kill   |
