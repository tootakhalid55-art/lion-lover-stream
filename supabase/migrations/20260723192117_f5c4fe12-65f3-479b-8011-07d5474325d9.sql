
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS allowed_ips text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.webhook_endpoints
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS request_body text,
  ADD COLUMN IF NOT EXISTS request_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS response_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dead boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS correlation_id text;

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS correlation_id text;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending
  ON public.webhook_deliveries (next_attempt_at)
  WHERE status = 'pending' AND dead = false;

CREATE INDEX IF NOT EXISTS idx_audit_correlation ON public.audit_logs (correlation_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_correlation ON public.billing_events (correlation_id);

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  key text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  request_hash text NOT NULL,
  response_status integer,
  response_body text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (org_id, key, method, path)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotency_keys TO authenticated;
GRANT ALL ON public.idempotency_keys TO service_role;

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idempotency_keys admin all"
  ON public.idempotency_keys
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON public.idempotency_keys (expires_at);
