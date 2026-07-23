# Step 7 — Chaos Test Matrix & Report

This report documents the failure scenarios the workflow layer is designed to
survive, the mechanism that protects each one, and the current verification
status. Deterministic unit coverage lives in
`src/lib/__tests__/workflow.test.ts`. Live chaos runs (kill DB pod mid-charge,
pause worker, replay webhook) require a staging cluster and are executed
manually per the runbook below; they are **not** part of CI.

## Matrix

Legend: **P** = protection in code, **T** = automated test, **R** = runbook step.

| Scenario                                       | Protection                                                                                 | Status |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | ------ |
| Successful renewal                             | `subscription-workflow.runRenewal` happy path                                              | P T    |
| Failed renewal (declined card)                 | `handleFailure` + `advanceDunning`; `normalizeFailure(insufficient_funds)` non-retryable   | P T    |
| Retry recovery (transient network)             | `withIdempotency` replays same `op_key`; `getRetryPolicy` schedules backoff               | P T    |
| Grace period recovery                          | `subscriptions.past_due → active` via `assertSubscriptionTransition`                        | P T    |
| Suspension                                     | dunning stage `suspend` transitions subscription to `paused`                                | P T    |
| Reactivation                                   | `paused → active` via `assertSubscriptionTransition`                                        | P T    |
| Duplicate payment callback                     | `inbound-webhooks.server.dedupe` on `(provider, provider_event_id)` unique                  | P R    |
| Duplicate webhook (same delivery replayed)     | `withIdempotency(webhook.inbound, provider_event_id)` short-circuits second run             | P R    |
| Late webhook (arrives after timeout)           | State machine idempotent — if payment already `captured`, second capture is a no-op         | P R    |
| Gateway timeout                                | `normalizeFailure → gateway_timeout` retryable; circuit breaker samples the failure         | P T    |
| Gateway HTTP 500                               | `normalizeFailure → gateway_unavailable` retryable                                          | P T    |
| Gateway invalid signature (inbound)            | `inbound-webhooks` rejects before dedupe; recorded in `gateway_webhook_events(status)`      | P R    |
| Gateway slow response                          | Latency captured in `gateway_health_samples`; surfaces in P95/P99                           | P     |
| Circuit breaker open                           | `instrumentAdapter` short-circuits with `code=circuit_open`; renewal defers                 | P R    |
| DB disconnect during renewal                   | Advisory lock scoped to transaction released on rollback; `billing_idempotency` stays `in_flight` and next tick retries | P R |
| DB disconnect during journal posting           | Same as above — invoice remains `issued`, no partial journal (journal write is single tx)   | P R    |
| DB disconnect before webhook dispatch          | Outbox row exists, worker retries; no lost event                                            | P R    |
| Lost worker (crash mid-job)                    | `advisory_lock` released on connection close; `billing_idempotency(in_flight)` picked up next tick | P R |
| Duplicate worker (two runners same tick)       | `try_billing_lock(_scope, _key)` grants to one; other returns false and skips               | P R    |
| Delayed worker                                 | Idempotency + advisory lock make late execution safe (still one renewal)                    | P R    |
| Concurrent renewal (two callers, same sub)     | Advisory lock on `renew:<sub_id>`; loser waits for release, sees `in_flight` idempotency and replays result | P R |
| Resume after crash                             | Because state machine transitions are single-row updates and every side effect is idempotent, restart re-enters cleanly | P R |
| Concurrent double-invoice attempt              | `billing_idempotency(invoice.issue, invoice_key)` uniqueness                                 | P T    |
| Concurrent double-capture attempt              | `billing_idempotency(payment.charge, intent_key)` uniqueness                                 | P T    |

## Live runbook (staging only)

1. **Concurrent renewal** — start two workers, seed one due subscription, run
   `billing.renew_subscriptions` on both. Verify: exactly one `renewed` event,
   one invoice, one journal entry, one payment intent.
2. **DB blip** — during a manual `runRenewal`, `kubectl delete pod pg-primary`.
   Verify: no half-written invoice; next tick completes cleanly with the same
   correlation ID.
3. **Gateway 500** — configure mock provider to return 500 for 5 minutes.
   Verify: circuit opens after N failures; dashboards show `OPEN`; retries
   resume when provider returns 200.
4. **Webhook replay** — POST the same provider webhook twice within 10s and
   again after 1h. Verify: `gateway_webhook_events` has one row, second is
   rejected as duplicate; no double side effects.
5. **Worker crash** — `kill -9` a worker mid-renewal. Verify: `billing_idempotency`
   row stays `in_flight` briefly; next scheduled tick completes.

## Concurrency invariants (verified per run)

For every renewal attempt, live SQL should show:

```sql
SELECT count(*) FROM subscription_events
 WHERE subscription_id = :id AND event_type = 'renewed' AND created_at > :cutoff;
-- expect: 1

SELECT count(*) FROM invoices WHERE subscription_id = :id AND period_start = :period;
-- expect: 1

SELECT count(*) FROM journal_entries WHERE ref_type = 'invoice' AND ref_id = :invoice_id;
-- expect: 1 (or 2 for tax/AR — same event_type)

SELECT count(*) FROM payment_intents WHERE invoice_id = :invoice_id AND status = 'captured';
-- expect: ≤ 1
```

Any deviation is a bug and must go into `STEP7_TECH_DEBT.md` with an
immediate hot-fix.
