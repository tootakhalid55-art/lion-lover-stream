# FINAL Database Schema — Nova TV v1.0.0

68 tables, all in `public` schema, all with RLS enabled.

## Auth & Identity
`profiles`, `user_roles`, `user_devices`, `user_sessions`, `login_attempts`, `security_events`, `audit_logs`

## Organizations & Resellers
`organizations`, `org_members`, `org_move_history`, `reseller_profiles`

## Catalog / Licensing
`packages`, `package_pricing`, `licenses`, `license_orders`, `activation_codes`, `coupons`, `promo_codes`

## Wallet & Ledger
`wallet_ledger`, `wallet_reservations`

## Billing & Accounting
`billing_plans`, `invoices`, `invoice_lines`, `invoice_sequences`, `doc_number_sequences`,
`journal_entries`, `journal_lines`, `tax_rules`, `fx_rates`,
`revenue_entries`, `revenue_schedules`, `billing_events`, `billing_idempotency`

## Subscriptions & Dunning
`subscriptions`, `subscription_events`, `dunning_policies`, `dunning_policy_stages`

## Payments & Reconciliation
`payment_gateway_configs`, `payment_intents`, `payment_methods`, `payments`, `payment_refunds`,
`reconciliation_batches`, `reconciliation_entries`,
`gateway_health_samples`, `gateway_retry_policies`, `gateway_webhook_events`

## API / Webhooks
`api_keys`, `api_request_log`, `webhook_endpoints`, `webhook_events`, `webhook_deliveries`,
`idempotency_keys`, `outbox_events`, `dead_letter_queue`

## Jobs & Ops
`job_definitions`, `job_runs`, `feature_flags`, `feature_flag_overrides`,
`system_health_snapshots`

## Notifications
`notifications`, `notification_channels_config`, `notification_templates`, `notification_deliveries`

## Usage & Metering
`usage_events`, `usage_daily`, `usage_meters`, `usage_meter_readings`

## RPC Functions (12)
`has_role`, `is_admin`, `is_staff`, `has_any_role`,
`is_org_member`, `can_org_read`, `org_ancestors`, `org_wallet_balances`,
`try_billing_lock`, `next_doc_number`,
`handle_new_user`, `tg_touch_updated_at`

## Conventions
- Every table: `id uuid pk`, `created_at`, `updated_at` where applicable.
- RLS: default deny; policies scope by `auth.uid()` and `is_org_member()`.
- Multi-tenant tables carry `org_id uuid` with org-scoped policies.
- Immutable ledgers (`wallet_ledger`, `journal_lines`, `billing_events`, `audit_logs`) are insert-only.
