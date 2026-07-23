
-- Reseller profile extras
ALTER TABLE public.reseller_profiles
  ADD COLUMN IF NOT EXISTS territory text,
  ADD COLUMN IF NOT EXISTS tax_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- License orders: expand state machine + pricing trace
ALTER TABLE public.license_orders
  DROP CONSTRAINT IF EXISTS license_orders_status_check;
ALTER TABLE public.license_orders
  ADD CONSTRAINT license_orders_status_check
  CHECK (status IN ('draft','submitted','pending','paid','fulfilled','cancelled','refunded','void'));
ALTER TABLE public.license_orders
  ADD COLUMN IF NOT EXISTS pricing_trace jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Wallet ledger: add hold/release kinds
ALTER TABLE public.wallet_ledger
  DROP CONSTRAINT IF EXISTS wallet_ledger_kind_check;
ALTER TABLE public.wallet_ledger
  ADD CONSTRAINT wallet_ledger_kind_check
  CHECK (kind IN ('topup','purchase','refund','commission','adjustment','hold','release'));

-- Wallet reservations (holds against available balance)
CREATE TABLE IF NOT EXISTS public.wallet_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  ref_type text NOT NULL,
  ref_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','released','captured')),
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ref_type, ref_id, status)
);
CREATE INDEX IF NOT EXISTS wallet_reservations_org_idx ON public.wallet_reservations(org_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_reservations TO authenticated;
GRANT ALL ON public.wallet_reservations TO service_role;
ALTER TABLE public.wallet_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY wallet_res_read ON public.wallet_reservations FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY wallet_res_write ON public.wallet_reservations FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Organization move history
CREATE TABLE IF NOT EXISTS public.org_move_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_parent_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  to_parent_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  reason text,
  actor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_move_history_org_idx ON public.org_move_history(org_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_move_history TO authenticated;
GRANT ALL ON public.org_move_history TO service_role;
ALTER TABLE public.org_move_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_move_read ON public.org_move_history FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY org_move_write ON public.org_move_history FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Available balance helper: ledger balance minus active holds
CREATE OR REPLACE FUNCTION public.org_wallet_balances(_org uuid)
RETURNS TABLE(ledger_cents bigint, reserved_cents bigint, available_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH l AS (
    SELECT COALESCE(SUM(delta_cents), 0)::bigint AS c
    FROM public.wallet_ledger WHERE org_id = _org
  ), r AS (
    SELECT COALESCE(SUM(amount_cents), 0)::bigint AS c
    FROM public.wallet_reservations WHERE org_id = _org AND status = 'held'
  )
  SELECT l.c, r.c, (l.c - r.c) FROM l, r;
$$;
