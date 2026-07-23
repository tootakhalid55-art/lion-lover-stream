
-- ============================================================================
-- Phase 2C — Resellers, Billing, REST API foundation
-- ============================================================================

-- ---------- Extend app_role enum ---------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='reseller_owner') THEN
    ALTER TYPE public.app_role ADD VALUE 'reseller_owner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='reseller_staff') THEN
    ALTER TYPE public.app_role ADD VALUE 'reseller_staff';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='billing_admin') THEN
    ALTER TYPE public.app_role ADD VALUE 'billing_admin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='api_client') THEN
    ALTER TYPE public.app_role ADD VALUE 'api_client';
  END IF;
END $$;

-- ---------- ORGANIZATIONS ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('platform','master_distributor','distributor','reseller','sub_reseller','customer')),
  parent_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','disabled')),
  currency text NOT NULL DEFAULT 'USD',
  country text,
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organizations_parent_idx ON public.organizations(parent_id);
CREATE INDEX IF NOT EXISTS organizations_type_idx ON public.organizations(type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ---------- ORG MEMBERS ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','admin','billing','support','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS org_members_user_idx ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS org_members_org_idx ON public.org_members(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- ---------- Helper: ancestors + membership -----------------------------------
CREATE OR REPLACE FUNCTION public.org_ancestors(_org uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE up AS (
    SELECT id, parent_id FROM public.organizations WHERE id = _org
    UNION ALL
    SELECT o.id, o.parent_id FROM public.organizations o JOIN up ON up.parent_id = o.id
  )
  SELECT id FROM up;
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.user_id = _user AND m.org_id IN (SELECT public.org_ancestors(_org))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_org_read(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_user) OR public.is_org_member(_user, _org)
$$;

-- Policies for organizations & members (after helpers exist)
DROP POLICY IF EXISTS orgs_read ON public.organizations;
CREATE POLICY orgs_read ON public.organizations FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), id));
DROP POLICY IF EXISTS orgs_write ON public.organizations;
CREATE POLICY orgs_write ON public.organizations FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS org_members_read ON public.org_members;
CREATE POLICY org_members_read ON public.org_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_org_read(auth.uid(), org_id));
DROP POLICY IF EXISTS org_members_write ON public.org_members;
CREATE POLICY org_members_write ON public.org_members FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- RESELLER PROFILES ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reseller_profiles (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  company text,
  contact_name text,
  email text,
  phone text,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  balance_cents bigint NOT NULL DEFAULT 0,
  credit_limit_cents bigint NOT NULL DEFAULT 0,
  price_level text NOT NULL DEFAULT 'standard',
  commission_model jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_profiles TO authenticated;
GRANT ALL ON public.reseller_profiles TO service_role;
ALTER TABLE public.reseller_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY resellers_read ON public.reseller_profiles FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY resellers_write ON public.reseller_profiles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- PACKAGE PRICING --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.package_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  price_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  region text,
  discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  margin_pct numeric(5,2) NOT NULL DEFAULT 0,
  promo_starts_at timestamptz,
  promo_ends_at timestamptz,
  visible boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS package_pricing_pkg_idx ON public.package_pricing(package_id);
CREATE INDEX IF NOT EXISTS package_pricing_org_idx ON public.package_pricing(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_pricing TO authenticated;
GRANT ALL ON public.package_pricing TO service_role;
ALTER TABLE public.package_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY pricing_read ON public.package_pricing FOR SELECT TO authenticated
  USING (org_id IS NULL OR public.can_org_read(auth.uid(), org_id));
CREATE POLICY pricing_write ON public.package_pricing FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- PROMO CODES ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('percent','amount','credits')),
  value numeric NOT NULL,
  currency text,
  package_id uuid REFERENCES public.packages(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY promo_admin ON public.promo_codes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- WALLET LEDGER ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  delta_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  kind text NOT NULL CHECK (kind IN ('topup','purchase','refund','commission','adjustment')),
  ref_type text,
  ref_id uuid,
  memo text,
  balance_after_cents bigint NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_org_idx ON public.wallet_ledger(org_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_ledger TO authenticated;
GRANT ALL ON public.wallet_ledger TO service_role;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY wallet_read ON public.wallet_ledger FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY wallet_write ON public.wallet_ledger FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- LICENSE ORDERS ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.license_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
  qty integer NOT NULL CHECK (qty > 0),
  unit_price_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  discount_cents bigint NOT NULL DEFAULT 0,
  tax_cents bigint NOT NULL DEFAULT 0,
  total_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','fulfilled','refunded','void')),
  invoice_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS license_orders_org_idx ON public.license_orders(org_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_orders TO authenticated;
GRANT ALL ON public.license_orders TO service_role;
ALTER TABLE public.license_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_read ON public.license_orders FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY orders_write ON public.license_orders FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- BILLING PLANS ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  interval text NOT NULL CHECK (interval IN ('month','year','custom')),
  price_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  usage_components jsonb NOT NULL DEFAULT '{}'::jsonb,
  trial_days integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_plans TO authenticated;
GRANT ALL ON public.billing_plans TO service_role;
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_read ON public.billing_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY plans_write ON public.billing_plans FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- SUBSCRIPTIONS ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.billing_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing','active','past_due','canceled','paused')),
  quantity integer NOT NULL DEFAULT 1,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subs_org_idx ON public.subscriptions(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subs_read ON public.subscriptions FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY subs_write ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- INVOICES ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','paid','void','uncollectible')),
  currency text NOT NULL DEFAULT 'USD',
  subtotal_cents bigint NOT NULL DEFAULT 0,
  tax_cents bigint NOT NULL DEFAULT 0,
  discount_cents bigint NOT NULL DEFAULT 0,
  total_cents bigint NOT NULL DEFAULT 0,
  due_at timestamptz,
  paid_at timestamptz,
  pdf_url text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_org_idx ON public.invoices(org_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_read ON public.invoices FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY invoices_write ON public.invoices FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  qty numeric NOT NULL DEFAULT 1,
  unit_price_cents bigint NOT NULL,
  amount_cents bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('subscription','usage','license','credit','tax','discount')),
  ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_lines_invoice_idx ON public.invoice_lines(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_lines TO authenticated;
GRANT ALL ON public.invoice_lines TO service_role;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_lines_read ON public.invoice_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.can_org_read(auth.uid(), i.org_id)));
CREATE POLICY invoice_lines_write ON public.invoice_lines FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Invoice number sequence per org
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  next_seq bigint NOT NULL DEFAULT 1
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_sequences TO authenticated;
GRANT ALL ON public.invoice_sequences TO service_role;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY inv_seq_admin ON public.invoice_sequences FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- PAYMENTS ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  gateway text NOT NULL CHECK (gateway IN ('stripe','moyasar','hyperpay','paytabs','manual','wallet')),
  gateway_ref text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','refunded','canceled')),
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  method jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_org_idx ON public.payments(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_invoice_idx ON public.payments(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_read ON public.payments FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY payments_write ON public.payments FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  gateway text NOT NULL,
  gateway_ref text NOT NULL,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  is_default boolean NOT NULL DEFAULT false,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_methods_org_idx ON public.payment_methods(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY pm_read ON public.payment_methods FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY pm_write ON public.payment_methods FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- TAX RULES / COUPONS ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  region text,
  rate_bps integer NOT NULL,
  kind text NOT NULL DEFAULT 'vat' CHECK (kind IN ('vat','gst','sales')),
  inclusive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_rules TO authenticated;
GRANT ALL ON public.tax_rules TO service_role;
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_read ON public.tax_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY tax_write ON public.tax_rules FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('percent','amount')),
  value numeric NOT NULL,
  currency text,
  plan_id uuid REFERENCES public.billing_plans(id) ON DELETE CASCADE,
  duration text NOT NULL DEFAULT 'once' CHECK (duration IN ('once','forever','repeating')),
  duration_months integer,
  max_redemptions integer,
  redemptions integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY coupons_admin ON public.coupons FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- USAGE ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text,
  dedupe_key text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, metric, dedupe_key)
);
CREATE INDEX IF NOT EXISTS usage_events_org_metric_idx ON public.usage_events(org_id, metric, occurred_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_read ON public.usage_events FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY usage_write ON public.usage_events FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.usage_daily (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric text NOT NULL,
  day date NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, metric, day)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_daily TO authenticated;
GRANT ALL ON public.usage_daily TO service_role;
ALTER TABLE public.usage_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_daily_read ON public.usage_daily FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY usage_daily_write ON public.usage_daily FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- API KEYS + REQUEST LOG ------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text NOT NULL,
  hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  expires_at timestamptz,
  last_used_at timestamptz,
  last_used_ip text,
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_keys_org_idx ON public.api_keys(org_id);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON public.api_keys(prefix);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_keys_read ON public.api_keys FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY api_keys_write ON public.api_keys FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.api_request_log (
  id bigserial PRIMARY KEY,
  key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  method text NOT NULL,
  path text NOT NULL,
  status integer NOT NULL,
  ms integer,
  ip text,
  user_agent text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_req_org_idx ON public.api_request_log(org_id, at DESC);
CREATE INDEX IF NOT EXISTS api_req_at_idx ON public.api_request_log(at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_request_log TO authenticated;
GRANT ALL ON public.api_request_log TO service_role;
ALTER TABLE public.api_request_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_req_read ON public.api_request_log FOR SELECT TO authenticated
  USING (org_id IS NULL AND public.is_admin(auth.uid()) OR public.can_org_read(auth.uid(), org_id));
CREATE POLICY api_req_write ON public.api_request_log FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- WEBHOOKS ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY[]::text[],
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wh_ep_org_idx ON public.webhook_endpoints(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY wh_ep_read ON public.webhook_endpoints FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY wh_ep_write ON public.webhook_endpoints FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wh_ev_kind_idx ON public.webhook_events(kind, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY wh_ev_admin ON public.webhook_events FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.webhook_events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','abandoned')),
  attempt integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  response_status integer,
  response_body text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wh_del_pending_idx ON public.webhook_deliveries(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS wh_del_ep_idx ON public.webhook_deliveries(endpoint_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY wh_del_read ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.webhook_endpoints e WHERE e.id = endpoint_id AND public.can_org_read(auth.uid(), e.org_id)));
CREATE POLICY wh_del_write ON public.webhook_deliveries FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ---------- Touch updated_at triggers on all new tables ----------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organizations','reseller_profiles','package_pricing','promo_codes',
    'license_orders','billing_plans','subscriptions','invoices','payments',
    'webhook_endpoints','webhook_deliveries','tax_rules'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t||'_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at()', t||'_touch', t);
  END LOOP;
END $$;

-- ---------- Bootstrap platform organization ---------------------------------
INSERT INTO public.organizations (id, name, slug, type, currency)
VALUES ('00000000-0000-0000-0000-000000000001', 'Nova TV Platform', 'platform', 'platform', 'USD')
ON CONFLICT (slug) DO NOTHING;
