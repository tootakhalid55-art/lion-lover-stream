# Workflow Trace Guide

The Trace Center (`/admin/billing/traces`) is the operator's single-pane view for
answering "what happened to this renewal / invoice / payment?". Every workflow
already carries a `correlation_id` through `AsyncLocalStorage`
(`src/lib/correlation.server.ts`) and stamps it on every write.

## What a trace covers

`getWorkflowTrace(correlationId)` merges rows from every table that carries the
ID into one chronological timeline:

| Source table              | Timeline label            | Meaning                                       |
| ------------------------- | ------------------------- | --------------------------------------------- |
| `subscription_events`     | `subscription_events`     | Lifecycle transitions (renewed, payment_failed, canceled, …) |
| `billing_events`          | `billing_events`          | Domain events (invoice.issued, payment.captured, dunning.*)  |
| `payment_intents`         | `payment_intents`         | Gateway charge/refund attempts with amounts and failure codes |
| `gateway_webhook_events`  | `gateway_webhook_events`  | Inbound provider callbacks after dedupe                       |
| `webhook_deliveries`      | `webhook_deliveries`      | Outbound webhook attempts (attempt #, HTTP status)            |
| `outbox_events`           | `outbox`                  | Transactional outbox rows (status, attempts, payload)         |
| `audit_logs`              | `audit_logs`              | Free-form actor audit trail                                   |

## Searching (`searchTraces`)

The search bar accepts any of:

- **Correlation ID** — direct lookup
- **Invoice ID** — resolves via `billing_events(ref_type=invoice)`,
  `payment_intents.invoice_id`, and `billing_idempotency` (op `invoice.issue`)
- **Subscription ID** — resolves via `subscription_events` and
  `payment_intents.subscription_id`
- **Payment Intent ID** — resolves via `payment_intents.id`
- **Order ID** — resolves via `billing_events(ref_type=order)`
- **Webhook / Event ID** — resolves via `webhook_deliveries.event_id` /
  `endpoint_id` and `gateway_webhook_events.provider_event_id`
- **Organization ID** — recent activity for the tenant

All hits are grouped by correlation ID, sorted by most-recent activity, and
capped at 100 to keep the picker responsive.

## Layered timeline

```
Order → Invoice → Payment Intent → Gateway → Journal → Billing Events → Notifications → Outbox → Webhooks → Audit
```

Every step is expandable and shows the raw JSON payload from its source row.
This is the same data the ops team would otherwise pull with hand-written SQL,
just pre-joined by correlation ID.

## Operator workflow

1. Customer opens a ticket for a failed renewal.
2. Paste the invoice number in Trace Center → find the correlation ID.
3. Open the timeline: verify the invoice was issued, whether a charge attempt
   reached the gateway, what the gateway returned, whether the outbox event
   was published, and whether the customer notification was delivered.
4. If a webhook is missing/late, cross-check `webhook_deliveries` for the same
   event_id.
5. Use the correlation ID in log searches to correlate with worker logs.

## Guarantees

- Correlation ID is generated at the outer entry point (job runner, HTTP
  handler, webhook handler) and propagated via `AsyncLocalStorage`.
- Every idempotency, audit, outbox, and gateway sample write includes it.
- Once assigned, a correlation ID never changes for the lifetime of a workflow
  attempt, including retries. Retries reuse the same ID so the trace tells the
  full story (see `withIdempotency` in `src/lib/billing-idempotency.server.ts`).
