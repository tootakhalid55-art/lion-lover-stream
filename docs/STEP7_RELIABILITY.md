# Step 7 — Reliability Report

## Summary

The billing workflow layer is designed to be **at-least-once with exactly-once
side effects**. Every retryable path is idempotent, every worker is
serialized by a Postgres advisory lock, and every side effect is either
transactional or gated by `billing_idempotency` keyed on
`(org_id, op_type, op_key)`.

## Recovery behavior

| Fault                        | Recovery                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Worker crash                 | `advisory_lock` releases on connection close; `billing_idempotency` row remains `in_flight`; next tick picks it up and completes. |
| Gateway timeout              | Retry per `gateway_retry_policies.backoff_seconds`; if attempts exceeded, mark payment `failed` with `gateway_timeout` and advance dunning. |
| Gateway 5xx                  | Same retry curve; classified as `gateway_unavailable` (retryable).                              |
| Card declined                | `normalizeFailure → insufficient_funds` non-retryable; enters dunning immediately.              |
| Duplicate webhook            | `gateway_webhook_events` unique `(provider, provider_event_id)`; `withIdempotency` replays result. |
| DB disconnect mid-renewal    | Single-transaction writes rollback cleanly; next tick reruns using same correlation ID.         |
| Concurrent renewal attempts  | Advisory lock on `renew:<sub_id>`; loser sees `in_flight` row and awaits/replays.               |
| Circuit breaker open         | Adapter throws `code=circuit_open`; renewal is deferred (no failure recorded on gateway).       |

## Retry behavior

- Policy per provider in `gateway_retry_policies`: max attempts, backoff array
  (seconds), circuit-breaker threshold and window.
- Outbox retries use exponential backoff with jitter, capped at 1 h
  (`outbox.server.nextBackoffMs`).
- Webhook deliveries retry via the same curve; after exceeding attempts, they
  are marked `dead` and mirrored to `dead_letter_queue`.

## Circuit breaker

- Per `(provider, mode)` pair.
- Threshold + window sourced from `gateway_retry_policies`.
- Open state short-circuits adapter calls with `code=circuit_open`; renewal
  workflow treats this as "defer, do not fail".
- Observability dashboard surfaces open breakers in real time.

## Idempotency verification

- **Renewal** — `payment.charge` key = `renew:<sub_id>:<period_start>` prevents
  double charge across retries.
- **Invoice issue** — `invoice.issue` key = `<sub_id>:<period_start>` prevents
  double invoice creation for the same period.
- **Webhook inbound** — `webhook.inbound` key = `<provider>:<event_id>`;
  reinforced by unique DB constraint on `gateway_webhook_events`.
- **Refunds** — `payment.refund` key = `<payment_id>:<amount_cents>`.

Every entry stores `status`, `result`, and `correlation_id`; replays return
the stored `result`.

## Data consistency verification

- Journal posting: `journal_entries` and `journal_lines` are written together
  in one transaction with the invoice `paid` update.
- Advisory locks (`try_billing_lock`) serialize the mutating branches so no
  two writers touch the same aggregate.
- State machine assertions (`state-machines.server.ts`) block illegal
  transitions at the write site; DB `CHECK` constraints backstop it.

## Remaining failure modes

1. **Non-transactional outbox insert on renewal side-effect table** — outbox
   insert is a separate call from the state update. In a rare crash between
   the two, the update commits but the outbox row is missing. Mitigation:
   next renewal tick's audit sweep detects a `renewed` event with no matching
   outbox row and re-emits. Priority: **medium** (`STEP7_TECH_DEBT.md`).
2. **In-worker circuit breaker map (`gateway-health.server`)** — state lives
   in memory per worker, so a fleet of N workers has N independent breakers.
   For small deployments this is acceptable; for high scale it should move to
   Redis or a DB-backed sample count. Priority: **medium**.
3. **DLQ has no auto-replay UI** — operators can requeue by hand, but there's
   no self-service replay center. Priority: **low**.
4. **Gateway sample table unbounded** — retention job pending. Priority:
   **low**.

## Test coverage

- `src/lib/__tests__/workflow.test.ts` — state machine transitions, failure
  normalization, backoff math (deterministic, CI-safe).
- `src/lib/__tests__/billing.test.ts` — tax math, invoice numbering, ZATCA QR.
- `src/lib/__tests__/rule-engine.test.ts` — pricing rule engine.

Live chaos runs are documented in `STEP7_CHAOS_REPORT.md`.
