# Step 7A — Foundations for Billing Automation & Payments

This sub-step lands the full Step 7 data model and the primary engines
(payments abstraction, subscription lifecycle, outbox, feature flags,
job registry) so that 7B (recurring/dunning/jobs) and 7C
(notifications/reconciliation/reliability/tests) plug in without
further schema changes.

## Payment architecture
- `src/lib/payments/types.ts` — provider-agnostic types (Charge, Refund, Webhook).
- `src/lib/payments/adapter.server.ts` — `PaymentAdapter` interface + registry
  with `NotImplementedAdapter` stubs for **Stripe, Moyasar, HyperPay, PayTabs**.
  Adding a gateway = one file that implements `PaymentAdapter` + `registerAdapter`.
- `payment_gateway_configs` — per-org enabled providers, mode, secret refs.
- `payment_intents` / `payment_refunds` — unified charge/refund records.

## Subscription engine
- `src/lib/subscriptions.server.ts` — create, changePlan (linear proration),
  renew, cancel (immediate or at period end), markPaymentFailed (past_due +
  grace), expireIfBeyondGrace.
- States: `trialing | active | past_due | grace | suspended | cancelled | expired`.
- Every transition logs `subscription_events` and enqueues an outbox event.

## Job system
- `job_definitions` / `job_runs` seeded with 11 workers covering renewals,
  invoice generation, payment collection, licence expiry, dunning,
  webhook retry, outbox dispatch, usage aggregation, overdue detection,
  notification dispatch.
- `src/lib/jobs.server.ts` — `registerJob`, `runJob(code)` with correlation
  IDs, duration tracking, DLQ on failure, avg-runtime update.
- `src/lib/jobs-registry.server.ts` — binds real handlers for renewal,
  expiry, and licence expiration. Other codes stubbed for 7B/7C.
- `/admin/jobs` — dashboard with Run Now, Pause/Resume, last success/failure,
  average runtime, and recent run history.

## Reliability
- `src/lib/outbox.server.ts` — `enqueueOutbox`, `moveToDeadLetter`,
  `nextBackoffMs` (exponential + jitter, cap 1h).
- `outbox_events` (pending → processing → delivered / failed) drained by
  the `outbox.dispatch` job.
- `dead_letter_queue` for terminal failures with resolve-by/note fields.

## Feature flags
- `feature_flags` seeded (payments.{stripe,moyasar,hyperpay,paytabs},
  billing.{auto_renew,dunning,usage}, notifications.{email,sms,whatsapp,push},
  api.v1).
- `feature_flag_overrides` (scope: platform / org / reseller).
- `src/lib/feature-flags.server.ts` — `isFlagEnabled` with 30s cache and
  precedence org > reseller > platform.

## Notifications & reconciliation
- `notification_templates`, `notification_deliveries`,
  `notification_channels_config` — multi-channel pipeline (email / SMS /
  WhatsApp / push / in-app). Dispatch worker wired in 7C.
- `reconciliation_batches`, `reconciliation_entries` — supports matched /
  partial / manual / unmatched / ignored states with matched_amount tracking.

## Foundations
- `revenue_schedules`, `revenue_entries` — straight-line/custom schedule
  ready for revenue recognition. No UI.
- `usage_meters` seeded (active_users, devices, api_requests, storage,
  streaming) with `usage_meter_readings`. Ready for usage billing.

## Remaining for 7B / 7C
- 7B: recurring billing worker chain (renew → invoice → collect → dunning),
       webhook retry drain, overdue detection, per-org dunning UI.
- 7C: notification dispatch adapters (Resend / Twilio / Meta / FCM),
       reconciliation upload UI + matcher, outbox dispatch worker,
       automated integration tests (adapters, lifecycle, dunning, retries).
