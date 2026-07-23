
-- 1. Internal-op idempotency (renewals, charges, refunds, webhook processing).
CREATE TABLE public.billing_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  op_type text NOT NULL,
  op_key text NOT NULL,
  correlation_id text,
  status text NOT NULL DEFAULT 'in_flight',
  result jsonb,
  error text,
  attempts integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  UNIQUE (org_id, op_type, op_key)
);
GRANT SELECT ON public.billing_idempotency TO authenticated;
GRANT ALL ON public.billing_idempotency TO service_role;
ALTER TABLE public.billing_idempotency ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read billing idempotency" ON public.billing_idempotency
  FOR SELECT TO authenticated USING (public.can_org_read(auth.uid(), org_id));
CREATE INDEX idx_billing_idem_status ON public.billing_idempotency(status, expires_at);

-- 2. Inbound webhook dedupe (per gateway provider event id).
CREATE TABLE public.gateway_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  event_type text,
  correlation_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received',
  raw jsonb,
  UNIQUE (provider, provider_event_id)
);
GRANT SELECT ON public.gateway_webhook_events TO authenticated;
GRANT ALL ON public.gateway_webhook_events TO service_role;
ALTER TABLE public.gateway_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read gateway wh events" ON public.gateway_webhook_events
  FOR SELECT TO authenticated USING (org_id IS NULL OR public.can_org_read(auth.uid(), org_id));

-- 3. Gateway health samples (rolling window; drop >30d).
CREATE TABLE public.gateway_health_samples (
  id bigserial PRIMARY KEY,
  provider text NOT NULL,
  mode text NOT NULL DEFAULT 'live',
  op text NOT NULL,
  latency_ms integer NOT NULL,
  success boolean NOT NULL,
  error_code text,
  correlation_id text,
  at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gateway_health_samples TO authenticated;
GRANT ALL ON public.gateway_health_samples TO service_role;
ALTER TABLE public.gateway_health_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read gateway health" ON public.gateway_health_samples
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX idx_gw_health_provider_at ON public.gateway_health_samples(provider, at DESC);

-- 4. Configurable retry policies per gateway.
CREATE TABLE public.gateway_retry_policies (
  provider text PRIMARY KEY,
  max_attempts integer NOT NULL DEFAULT 5,
  backoff_seconds jsonb NOT NULL DEFAULT '[30,120,600,1800,7200]'::jsonb,
  retry_on jsonb NOT NULL DEFAULT '["network","5xx","rate_limited","timeout"]'::jsonb,
  circuit_breaker_threshold integer NOT NULL DEFAULT 10,
  circuit_breaker_window_seconds integer NOT NULL DEFAULT 300,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gateway_retry_policies TO authenticated;
GRANT ALL ON public.gateway_retry_policies TO service_role;
ALTER TABLE public.gateway_retry_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read retry policies" ON public.gateway_retry_policies
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
INSERT INTO public.gateway_retry_policies(provider) VALUES ('stripe'),('moyasar'),('hyperpay'),('paytabs')
  ON CONFLICT DO NOTHING;

-- 5. Extend gateway configs with declared capabilities (future-proof adapter contract).
ALTER TABLE public.payment_gateway_configs
  ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 6. Advisory-lock helper — used by renewal/dunning/webhook drain to prevent duplicate runs.
CREATE OR REPLACE FUNCTION public.try_billing_lock(_scope text, _key text)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_xact_lock(hashtextextended(_scope || ':' || _key, 0));
$$;
REVOKE ALL ON FUNCTION public.try_billing_lock(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.try_billing_lock(text, text) TO service_role;

-- 7. Recent billing metrics view (last 24h & 7d).
CREATE OR REPLACE VIEW public.billing_metrics_recent AS
WITH renewals AS (
  SELECT
    org_id,
    count(*) FILTER (WHERE event_type = 'renewed' AND created_at > now() - interval '24 hours') AS renewed_24h,
    count(*) FILTER (WHERE event_type = 'payment_failed' AND created_at > now() - interval '24 hours') AS failed_24h,
    count(*) FILTER (WHERE event_type = 'renewed' AND created_at > now() - interval '7 days') AS renewed_7d,
    count(*) FILTER (WHERE event_type = 'payment_failed' AND created_at > now() - interval '7 days') AS failed_7d
  FROM public.subscription_events GROUP BY org_id
), retries AS (
  SELECT org_id,
    coalesce(avg(attempts) FILTER (WHERE created_at > now() - interval '7 days'), 0) AS avg_retry_7d
  FROM public.billing_idempotency GROUP BY org_id
)
SELECT
  r.org_id,
  r.renewed_24h, r.failed_24h, r.renewed_7d, r.failed_7d,
  CASE WHEN (r.renewed_24h + r.failed_24h) > 0
    THEN round(100.0 * r.renewed_24h / (r.renewed_24h + r.failed_24h), 2) END AS success_rate_24h,
  CASE WHEN (r.renewed_7d + r.failed_7d) > 0
    THEN round(100.0 * r.renewed_7d / (r.renewed_7d + r.failed_7d), 2) END AS success_rate_7d,
  coalesce(rt.avg_retry_7d, 0) AS avg_retry_7d
FROM renewals r LEFT JOIN retries rt ON rt.org_id = r.org_id;
GRANT SELECT ON public.billing_metrics_recent TO authenticated;
