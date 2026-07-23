
-- =========================================================================
-- STEP 7 – Billing Automation & Payments
-- =========================================================================

-- ---------- Extend subscriptions ----------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_billing_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_billing_at timestamptz,
  ADD COLUMN IF NOT EXISTS dunning_stage int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dunning_policy_id uuid,
  ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS collection_method text NOT NULL DEFAULT 'charge_automatically';

CREATE INDEX IF NOT EXISTS idx_subs_next_billing ON public.subscriptions(next_billing_at) WHERE status IN ('active','trialing','past_due');
CREATE INDEX IF NOT EXISTS idx_subs_status_org ON public.subscriptions(org_id, status);

-- ---------- Subscription events ----------
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_state text,
  to_state text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_events_read" ON public.subscription_events FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));
CREATE INDEX IF NOT EXISTS idx_sub_events_sub ON public.subscription_events(subscription_id, created_at DESC);

-- ---------- Payment gateway configs ----------
CREATE TABLE IF NOT EXISTS public.payment_gateway_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe','moyasar','hyperpay','paytabs')),
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test','live')),
  display_name text,
  publishable_key text,
  secret_key_ref text,
  webhook_secret_ref text,
  merchant_id text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_enabled boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider, mode)
);
GRANT SELECT ON public.payment_gateway_configs TO authenticated;
GRANT ALL ON public.payment_gateway_configs TO service_role;
ALTER TABLE public.payment_gateway_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gateway_configs_read" ON public.payment_gateway_configs FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id)));
CREATE TRIGGER trg_gateway_configs_touch BEFORE UPDATE ON public.payment_gateway_configs
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ---------- Payment intents ----------
CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_ref text,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'requires_action',
  failure_code text,
  failure_message text,
  client_secret text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_intents TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_intents_read" ON public.payment_intents FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));
CREATE UNIQUE INDEX IF NOT EXISTS uq_pi_provider_ref ON public.payment_intents(provider, provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pi_invoice ON public.payment_intents(invoice_id);
CREATE TRIGGER trg_pi_touch BEFORE UPDATE ON public.payment_intents
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ---------- Payment refunds ----------
CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_ref text,
  amount_cents bigint NOT NULL,
  currency text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_refunds TO authenticated;
GRANT ALL ON public.payment_refunds TO service_role;
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_refunds_read" ON public.payment_refunds FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));
CREATE TRIGGER trg_pr_touch BEFORE UPDATE ON public.payment_refunds
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ---------- Dunning ----------
CREATE TABLE IF NOT EXISTS public.dunning_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  grace_days int NOT NULL DEFAULT 3,
  terminate_after_days int NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dunning_policies TO authenticated;
GRANT ALL ON public.dunning_policies TO service_role;
ALTER TABLE public.dunning_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dunning_read" ON public.dunning_policies FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id)));
CREATE TRIGGER trg_dp_touch BEFORE UPDATE ON public.dunning_policies
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.dunning_policy_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.dunning_policies(id) ON DELETE CASCADE,
  stage_index int NOT NULL,
  offset_days int NOT NULL,
  action text NOT NULL CHECK (action IN ('friendly_reminder','second_reminder','final_reminder','suspend','terminate','retry_payment')),
  channels text[] NOT NULL DEFAULT ARRAY['email']::text[],
  template_code text,
  UNIQUE (policy_id, stage_index)
);
GRANT SELECT ON public.dunning_policy_stages TO authenticated;
GRANT ALL ON public.dunning_policy_stages TO service_role;
ALTER TABLE public.dunning_policy_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dunning_stages_read" ON public.dunning_policy_stages FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_dunning_policy_fk
  FOREIGN KEY (dunning_policy_id) REFERENCES public.dunning_policies(id) ON DELETE SET NULL
  NOT VALID;

-- ---------- Job system ----------
CREATE TABLE IF NOT EXISTS public.job_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  schedule text NOT NULL,
  handler text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  max_retries int NOT NULL DEFAULT 3,
  timeout_seconds int NOT NULL DEFAULT 300,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  avg_runtime_ms int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.job_definitions TO authenticated;
GRANT ALL ON public.job_definitions TO service_role;
ALTER TABLE public.job_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_admin_read" ON public.job_definitions FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));
CREATE TRIGGER trg_jobs_touch BEFORE UPDATE ON public.job_definitions
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_definitions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms int,
  attempt int NOT NULL DEFAULT 1,
  error text,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  triggered_by text NOT NULL DEFAULT 'scheduler'
);
GRANT SELECT ON public.job_runs TO authenticated;
GRANT ALL ON public.job_runs TO service_role;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_runs_admin_read" ON public.job_runs FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_job_runs_job ON public.job_runs(job_id, started_at DESC);

-- ---------- Notifications ----------
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  locale text NOT NULL DEFAULT 'ar',
  channel text NOT NULL CHECK (channel IN ('email','sms','whatsapp','push','in_app')),
  subject text,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code, locale, channel)
);
GRANT SELECT ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_tpl_read" ON public.notification_templates FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id)));
CREATE TRIGGER trg_nt_touch BEFORE UPDATE ON public.notification_templates
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  template_code text NOT NULL,
  channel text NOT NULL,
  recipient text NOT NULL,
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  provider text,
  provider_ref text,
  error text,
  correlation_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_deliv_read" ON public.notification_deliveries FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id)) OR user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_nd_status_next ON public.notification_deliveries(status, next_attempt_at);
CREATE TRIGGER trg_nd_touch BEFORE UPDATE ON public.notification_deliveries
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.notification_channels_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel text NOT NULL,
  provider text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, channel)
);
GRANT SELECT ON public.notification_channels_config TO authenticated;
GRANT ALL ON public.notification_channels_config TO service_role;
ALTER TABLE public.notification_channels_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_ch_read" ON public.notification_channels_config FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id)));
CREATE TRIGGER trg_ncc_touch BEFORE UPDATE ON public.notification_channels_config
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ---------- Reconciliation ----------
CREATE TABLE IF NOT EXISTS public.reconciliation_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  source text NOT NULL DEFAULT 'upload',
  period_start date,
  period_end date,
  status text NOT NULL DEFAULT 'pending',
  total_amount_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  matched_count int NOT NULL DEFAULT 0,
  unmatched_count int NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reconciliation_batches TO authenticated;
GRANT ALL ON public.reconciliation_batches TO service_role;
ALTER TABLE public.reconciliation_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recon_batch_read" ON public.reconciliation_batches FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR (org_id IS NOT NULL AND public.is_org_member(auth.uid(), org_id)));
CREATE TRIGGER trg_rb_touch BEFORE UPDATE ON public.reconciliation_batches
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.reconciliation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.reconciliation_batches(id) ON DELETE CASCADE,
  external_ref text NOT NULL,
  amount_cents bigint NOT NULL,
  currency text NOT NULL,
  occurred_at timestamptz,
  status text NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched','matched','partial','manual','ignored')),
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  matched_amount_cents bigint NOT NULL DEFAULT 0,
  matched_by uuid,
  matched_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reconciliation_entries TO authenticated;
GRANT ALL ON public.reconciliation_entries TO service_role;
ALTER TABLE public.reconciliation_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recon_entry_read" ON public.reconciliation_entries FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_re_batch ON public.reconciliation_entries(batch_id, status);
CREATE TRIGGER trg_re_touch BEFORE UPDATE ON public.reconciliation_entries
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ---------- Outbox / DLQ ----------
CREATE TABLE IF NOT EXISTS public.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','delivered','failed')),
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
GRANT SELECT ON public.outbox_events TO authenticated;
GRANT ALL ON public.outbox_events TO service_role;
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outbox_admin_read" ON public.outbox_events FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_outbox_ready ON public.outbox_events(status, next_attempt_at);
CREATE TRIGGER trg_ob_touch BEFORE UPDATE ON public.outbox_events
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.dead_letter_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_id uuid,
  event_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  correlation_id text,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dead_letter_queue TO authenticated;
GRANT ALL ON public.dead_letter_queue TO service_role;
ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dlq_admin_read" ON public.dead_letter_queue FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- ---------- Feature flags ----------
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text,
  default_enabled boolean NOT NULL DEFAULT false,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ff_read" ON public.feature_flags FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_ff_touch BEFORE UPDATE ON public.feature_flags
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.feature_flag_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL REFERENCES public.feature_flags(key) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('platform','org','reseller')),
  scope_id uuid,
  enabled boolean NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flag_key, scope, scope_id)
);
GRANT SELECT ON public.feature_flag_overrides TO authenticated;
GRANT ALL ON public.feature_flag_overrides TO service_role;
ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ff_override_read" ON public.feature_flag_overrides FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR (scope = 'org' AND scope_id IS NOT NULL AND public.is_org_member(auth.uid(), scope_id)));
CREATE TRIGGER trg_ffo_touch BEFORE UPDATE ON public.feature_flag_overrides
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ---------- Revenue recognition foundation ----------
CREATE TABLE IF NOT EXISTS public.revenue_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  total_amount_cents bigint NOT NULL,
  currency text NOT NULL,
  method text NOT NULL DEFAULT 'straight_line',
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.revenue_schedules TO authenticated;
GRANT ALL ON public.revenue_schedules TO service_role;
ALTER TABLE public.revenue_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rev_sched_read" ON public.revenue_schedules FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.revenue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.revenue_schedules(id) ON DELETE CASCADE,
  period date NOT NULL,
  amount_cents bigint NOT NULL,
  recognized_at timestamptz,
  UNIQUE (schedule_id, period)
);
GRANT SELECT ON public.revenue_entries TO authenticated;
GRANT ALL ON public.revenue_entries TO service_role;
ALTER TABLE public.revenue_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rev_entry_read" ON public.revenue_entries FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- ---------- Usage-based billing foundation ----------
CREATE TABLE IF NOT EXISTS public.usage_meters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  unit text NOT NULL,
  aggregation text NOT NULL DEFAULT 'sum' CHECK (aggregation IN ('sum','max','last','count','unique')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.usage_meters TO authenticated;
GRANT ALL ON public.usage_meters TO service_role;
ALTER TABLE public.usage_meters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_meters_read" ON public.usage_meters FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.usage_meter_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id uuid NOT NULL REFERENCES public.usage_meters(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.usage_meter_readings TO authenticated;
GRANT ALL ON public.usage_meter_readings TO service_role;
ALTER TABLE public.usage_meter_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_read" ON public.usage_meter_readings FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_org_member(auth.uid(), org_id));
CREATE INDEX IF NOT EXISTS idx_umr_org_period ON public.usage_meter_readings(org_id, meter_id, period_start);

-- ---------- Seed core feature flags ----------
INSERT INTO public.feature_flags (key, description, default_enabled, category) VALUES
  ('payments.stripe', 'Enable Stripe gateway adapter', true, 'payments'),
  ('payments.moyasar', 'Enable Moyasar gateway adapter', false, 'payments'),
  ('payments.hyperpay', 'Enable HyperPay gateway adapter', false, 'payments'),
  ('payments.paytabs', 'Enable PayTabs gateway adapter', false, 'payments'),
  ('billing.auto_renew', 'Enable automatic subscription renewal', true, 'billing'),
  ('billing.dunning', 'Enable dunning engine', true, 'billing'),
  ('billing.usage', 'Enable usage-based billing', false, 'billing'),
  ('notifications.email', 'Deliver email notifications', true, 'notifications'),
  ('notifications.sms', 'Deliver SMS notifications', false, 'notifications'),
  ('notifications.whatsapp', 'Deliver WhatsApp notifications', false, 'notifications'),
  ('notifications.push', 'Deliver push notifications', false, 'notifications'),
  ('api.v1', 'Public REST API v1', true, 'api')
ON CONFLICT (key) DO NOTHING;

-- ---------- Seed job registry ----------
INSERT INTO public.job_definitions (code, name, description, schedule, handler, max_retries) VALUES
  ('billing.renew_subscriptions',    'Renew Subscriptions',        'Detect due subscriptions and issue renewal invoices',        '*/15 * * * *', 'billing.renewSubscriptions', 3),
  ('billing.generate_invoices',      'Generate Invoices',          'Issue pending invoices for the current period',              '0 * * * *',    'billing.generateInvoices',   3),
  ('billing.collect_payments',       'Collect Payments',           'Attempt payment collection for outstanding invoices',        '*/30 * * * *', 'billing.collectPayments',    5),
  ('billing.expire_subscriptions',   'Expire Subscriptions',       'Mark subscriptions past grace period as expired',            '0 * * * *',    'billing.expireSubscriptions',2),
  ('licensing.expire_licenses',      'Expire Licenses',            'Deactivate licenses past their expiration',                  '0 * * * *',    'licensing.expireLicenses',   2),
  ('billing.dunning_run',            'Dunning Run',                'Advance dunning stages and send reminders',                  '0 * * * *',    'billing.dunningRun',         3),
  ('webhooks.retry',                 'Webhook Retry',              'Retry failed webhook deliveries',                            '*/5 * * * *',  'webhooks.retry',             10),
  ('outbox.dispatch',                'Outbox Dispatch',            'Publish pending outbox events',                              '* * * * *',    'outbox.dispatch',            5),
  ('usage.aggregate',                'Usage Aggregation',          'Aggregate usage events into daily meter readings',           '10 * * * *',   'usage.aggregate',            3),
  ('billing.overdue_detection',      'Overdue Detection',          'Flag invoices past due date',                                '30 * * * *',   'billing.detectOverdue',      2),
  ('notifications.dispatch',         'Notification Dispatch',      'Send queued notification deliveries',                        '* * * * *',    'notifications.dispatch',     5)
ON CONFLICT (code) DO NOTHING;

-- ---------- Seed usage meters ----------
INSERT INTO public.usage_meters (code, name, unit, aggregation) VALUES
  ('active_users',   'Active Users',   'users',    'unique'),
  ('devices',        'Devices',        'devices',  'max'),
  ('api_requests',   'API Requests',   'requests', 'sum'),
  ('storage',        'Storage',        'bytes',    'last'),
  ('streaming',      'Streaming',      'minutes',  'sum')
ON CONFLICT (code) DO NOTHING;
