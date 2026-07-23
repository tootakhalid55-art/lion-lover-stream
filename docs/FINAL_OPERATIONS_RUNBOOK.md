# FINAL Operations Runbook — Nova TV v1.0.0

Consolidated ops guide. Detailed sub-runbooks live in `docs/STEP8_OPS_RUNBOOK.md`
and `docs/STEP8_DR_RUNBOOK.md`.

## On-call

- **Primary:** SRE PagerDuty rotation.
- **Escalation:** Engineering lead → Head of Engineering.
- **Comms:** `#ops-incident` Slack, status page auto-updated.

## Daily
- Check `admin.system` (health snapshots, breaker state, DLQ depth).
- Review overnight `job_runs` failures.
- Review `admin.billing.observability` KPIs.

## Weekly
- Backup verify: `scripts/backup-verify.sh` (nightly cron; audit report).
- Review `audit_logs` for elevated privilege events.
- Review open alerts vs threshold tuning (S-02).

## Monthly
- DR tabletop.
- Dependency updates + `bun audit`.
- Rotate any credentials nearing 12-month age.

## Quarterly
- Full DR restore drill (target ≤ 60 min). Last: 2026-07-14 (42 min).
- Load test replay against staging.
- Access review (org members, admin roles).

## Alerts → response

| Alert                              | Severity | First action |
|------------------------------------|:--------:|--------------|
| `AUTH_FAILURES_SPIKE`              | P2       | Check `security_events`; block IP if brute-force |
| `RENEWAL_FAILURE_RATE_HIGH`        | P1       | Trace via `admin.billing.traces`; check gateway breaker |
| `WEBHOOK_LAG_HIGH`                 | P2       | Scale worker concurrency; inspect DLQ |
| `DB_CPU_HIGH`                      | P2       | Check slow queries; scale compute |
| `GATEWAY_BREAKER_OPEN`             | P1       | Check `gateway_health_samples`; provider status |
| `BACKUP_VERIFY_FAILED`             | P2       | Re-run; escalate if second failure |
| `PDF_LATENCY_P99_HIGH`             | P3       | Known (D-04); monitor only |
| `DLQ_DEPTH_HIGH`                   | P1       | Investigate root cause before replay |
| `HEALTH_READY_FAILING`             | P1       | Page primary immediately |

## Incident response

1. **Detect** — PagerDuty or health alert.
2. **Assess** — open `admin.billing.traces`, correlate by ID.
3. **Contain** — `MAINTENANCE=1` if writes must be frozen; pause offending job (`jobs.pause`).
4. **Communicate** — post to `#ops-incident`, update status page.
5. **Recover** — apply fix (rollback, PITR, config toggle).
6. **Postmortem** — within 5 business days, blameless, filed in `docs/postmortems/`.

## Common operations

- **Pause a job:** `jobs.pause('<jobId>')` in `admin.jobs`.
- **Replay webhook:** `admin.notifications` → Deliveries → Replay.
- **Revoke session:** `admin.sessions` → Revoke (all rows audit-logged).
- **Rotate API key:** `admin.api` → Rotate; old key valid 24h.
- **Force reload clients:** bump build; stale-chunk detector auto-reloads.
- **Enter maintenance:** set `MAINTENANCE=1` env; redeploy.

## Disaster recovery

See `docs/STEP8_DR_RUNBOOK.md`. RPO ≤ 5m, RTO ≤ 60m. PITR window 7 days.

## Documentation index

- `docs/FINAL_PRODUCTION_CERTIFICATION.md` — release certification.
- `docs/FINAL_DATABASE_SCHEMA.md` — schema map.
- `docs/FINAL_API_REFERENCE.md` — API surface.
- `docs/FINAL_ENVIRONMENT_VARIABLES.md` — env catalog.
- `docs/FINAL_DEPLOYMENT_GUIDE.md` — deploy + rollback.
- `docs/STEP7_*` — reliability, observability, chaos, tech debt.
- `docs/STEP8_*` — audit, perf, load, DR, monitoring, CI/CD, infra, ops, readiness.
- `CHANGELOG.md`, `docs/RELEASE_NOTES_v1.0.0.md`, `docs/MIGRATION_HISTORY.md`.
