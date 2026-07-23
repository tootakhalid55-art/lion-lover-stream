# Step 7 — Production Readiness Report

## Verified invariants

| Invariant                          | Enforcement                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| No duplicate accounting entries    | Journal posting inside the `markInvoicePaid` transaction; `billing_idempotency(payment.charge)` prevents re-invocation. |
| No duplicate invoices              | `billing_idempotency(invoice.issue, sub:period)` unique key.                                        |
| No duplicate payments              | `billing_idempotency(payment.charge, renew:sub:period)` + provider-side idempotency keys.           |
| No duplicate subscriptions         | Renewal never inserts subscriptions; only mutates existing rows behind advisory lock.              |
| No orphaned journals               | Journals are always keyed to an invoice ID via `ref_id`; written in the same tx as invoice `paid`. |
| No orphaned events                 | Outbox is the sole external-delivery channel; every event has an aggregate ref.                    |
| No lost webhooks                   | Retry curve + `dead_letter_queue` mirror + observability alert on non-zero DLQ.                    |
| No broken state transitions        | `assertSubscriptionTransition/InvoiceTransition/PaymentTransition` at write sites.                  |
| No tenant isolation violations     | RLS on every billing table; server functions scope every query with `org_id`.                       |

## Checks operators can run

```sql
-- Duplicate invoices for a period (should return 0 rows)
SELECT subscription_id, period_start, count(*)
  FROM invoices
 GROUP BY subscription_id, period_start
HAVING count(*) > 1;

-- Duplicate captured payments per invoice (should return 0)
SELECT invoice_id, count(*)
  FROM payment_intents
 WHERE status = 'captured'
 GROUP BY invoice_id
HAVING count(*) > 1;

-- Orphaned journal entries
SELECT j.id FROM journal_entries j
 LEFT JOIN invoices i ON i.id = j.ref_id AND j.ref_type = 'invoice'
 WHERE i.id IS NULL AND j.ref_type = 'invoice';

-- DLQ size (target: 0)
SELECT count(*) FROM dead_letter_queue;

-- Circuit-breaker inspection
SELECT provider, mode, count(*) FILTER (WHERE success = false) AS fails
  FROM gateway_health_samples
 WHERE at > now() - interval '1 hour'
 GROUP BY provider, mode;
```

## Green checklist

- [x] Correlation IDs propagate via `AsyncLocalStorage` on every workflow entry.
- [x] Every mutating billing operation is wrapped in `withIdempotency` + advisory lock.
- [x] Every state transition passes through an explicit state machine.
- [x] Every gateway call is instrumented for latency, success, and circuit-breaker sampling.
- [x] Trace Center resolves invoice / subscription / payment / order / webhook / org to correlation IDs.
- [x] Observability dashboard exposes P50/P95/P99 latency, retries, dunning conversion, DLQ, circuit-breaker state.
- [x] Deterministic tests cover state machines, failure normalization, backoff.
- [x] Chaos matrix documented with live-run runbook.
- [x] RLS policies + GRANTs on every billing table (Steps 4–6 hardening).
- [x] Reports written for Trace, Observability, Chaos, Reliability, Readiness, and Tech Debt.

## Feature freeze

Feature development is now frozen. The only accepted commits until Step 8
completes are:

1. Bug fixes tied to a written repro.
2. Items from `STEP7_TECH_DEBT.md`.
3. Step 8 hardening work (security, load testing, DR, monitoring, CI/CD,
   infra automation, deployment runbook, ops docs, release checklist).
