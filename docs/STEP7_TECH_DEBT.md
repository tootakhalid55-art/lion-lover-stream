# Step 7 — Remaining Technical Debt (prioritized)

## P1 — must fix before customer launch

1. **Outbox emission not co-transactional with state update.**
   The renewal writes `subscriptions.status` and later `enqueueOutbox(...)` as a
   separate statement. A crash between them leaves the event un-emitted.
   Fix: wrap both in a single transaction using `supabase.rpc` or move the
   outbox insert into the same `UPDATE ... RETURNING` batch. Add a periodic
   sweeper that re-emits missing events by diffing `subscription_events` vs
   `outbox_events`.

2. **In-memory circuit breaker is per-worker.**
   `src/lib/gateway-health.server.ts` keeps failure counters in a
   `Map<string, Failure[]>`. With a horizontal worker fleet, an outage must
   fail N × threshold times before every worker opens its breaker. Move state
   to a shared store (Redis) or replace with a SQL-backed count keyed on
   `gateway_health_samples`.

## P2 — should fix in Step 8

3. **`gateway_health_samples` retention.**
   Table is append-only and unbounded. Add a `billing.retention` job that
   trims to 90 days.

4. **DLQ replay UX.**
   `dead_letter_queue` is populated but there is no admin action to requeue.
   Add a replay button and audit log entry.

5. **Notifications channel wiring.**
   Dunning stages record intent (`notification.dispatch` events) but the
   channel workers (`email`, `sms`, `push`) are stubbed. Wire real providers
   before dunning is customer-visible.

6. **Job runner scheduler.**
   `job_runs` exists and handlers are registered, but there is no in-repo
   scheduler. Deploy either pg_cron rows (documented in `schedule-jobs`) or a
   dedicated worker; either way, needs a Step 8 runbook entry.

## P3 — quality-of-life

7. **Per-org observability filter.**
   `getObservabilitySnapshot` is platform-wide. Add an org selector for
   partner/reseller support.

8. **Trace Center — organization search paging.**
   Currently caps at 200 rows. Add cursor pagination for busy tenants.

9. **Structured logging.**
   Replace remaining `console.error` calls with a leveled logger that emits
   the correlation ID.

10. **Test doubles for adapters.**
    Add a `MockAdapter` fixture that scripts success/failure sequences, so
    `runRenewal` can be tested end-to-end in CI without live gateways.

11. **OpenAPI coverage for admin endpoints.**
    Public API v1 is documented; admin server functions are not. Autogenerate
    from `createServerFn` validators.

## Not-blocking notes

- `billing.generate_invoices`, `billing.collect_payments`, `webhooks.retry`,
  `outbox.dispatch`, `usage.aggregate`, `billing.overdue_detection`, and
  `notifications.dispatch` are registered as `skipped` handlers because the
  renewal workflow performs the same work inline. Keep them as documented
  no-ops so the job registry stays discoverable; delete them once the queue
  scheduler is wired and each concern is split back out (P2 item #6).
