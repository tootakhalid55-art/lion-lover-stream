
-- Extend invoices with billing engine fields
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft','issued','sent','partially_paid','paid','overdue','cancelled','refunded','written_off','void','open','uncollectible'));

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'tax_invoice'
    CHECK (doc_type IN ('tax_invoice','simplified_tax_invoice','credit_note','debit_note','proforma','renewal_invoice')),
  ADD COLUMN IF NOT EXISTS base_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS fx_rate numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_total_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_due_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_strategy text NOT NULL DEFAULT 'immediate'
    CHECK (billing_strategy IN ('immediate','scheduled','recurring','usage','manual')),
  ADD COLUMN IF NOT EXISTS parent_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS invoices_doc_type_idx ON public.invoices(doc_type);
CREATE INDEX IF NOT EXISTS invoices_status_due_idx ON public.invoices(status, due_at);
CREATE INDEX IF NOT EXISTS invoices_source_idx ON public.invoices(source_type, source_id);

-- Extend invoice_lines with tax metadata
ALTER TABLE public.invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_kind_check;
ALTER TABLE public.invoice_lines ADD CONSTRAINT invoice_lines_kind_check
  CHECK (kind IN ('subscription','usage','license','credit','tax','discount','adjustment','renewal','upgrade','downgrade'));
ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS tax_kind text NOT NULL DEFAULT 'vat'
    CHECK (tax_kind IN ('vat','zero_rated','exempt','reverse_charge','none')),
  ADD COLUMN IF NOT EXISTS tax_rate_bps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount_cents bigint NOT NULL DEFAULT 0;

-- FX rate snapshots (immutable)
CREATE TABLE IF NOT EXISTS public.fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate numeric NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  effective_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fx_rates_lookup ON public.fx_rates(base_currency, quote_currency, effective_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_rates TO authenticated;
GRANT ALL ON public.fx_rates TO service_role;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY fx_read ON public.fx_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY fx_write ON public.fx_rates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Journal entries (posting engine)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entry_no bigserial UNIQUE,
  event_type text NOT NULL,
  ref_type text NOT NULL,
  ref_id uuid NOT NULL,
  memo text,
  currency text NOT NULL,
  total_debit_cents bigint NOT NULL DEFAULT 0,
  total_credit_cents bigint NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  posted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journal_org_idx ON public.journal_entries(org_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS journal_ref_idx ON public.journal_entries(ref_type, ref_id);
GRANT SELECT, INSERT ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY je_read ON public.journal_entries FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY je_write ON public.journal_entries FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account text NOT NULL,
  side text NOT NULL CHECK (side IN ('debit','credit')),
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  memo text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS jl_entry_idx ON public.journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS jl_account_idx ON public.journal_lines(account);
GRANT SELECT, INSERT ON public.journal_lines TO authenticated;
GRANT ALL ON public.journal_lines TO service_role;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY jl_read ON public.journal_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journal_entries e WHERE e.id = entry_id AND public.can_org_read(auth.uid(), e.org_id)));
CREATE POLICY jl_write ON public.journal_lines FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Billing events (event bus persistence — InvoiceIssued, etc.)
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  ref_type text NOT NULL,
  ref_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_events_org_idx ON public.billing_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_events_type_idx ON public.billing_events(event_type, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY be_read ON public.billing_events FOR SELECT TO authenticated
  USING (public.can_org_read(auth.uid(), org_id));
CREATE POLICY be_write ON public.billing_events FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Number sequence per (org, fiscal_year, doc_type) — replaces flat per-org seq
CREATE TABLE IF NOT EXISTS public.doc_number_sequences (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  doc_type text NOT NULL,
  branch text NOT NULL DEFAULT 'MAIN',
  next_seq bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (org_id, fiscal_year, doc_type, branch)
);
GRANT SELECT, INSERT, UPDATE ON public.doc_number_sequences TO authenticated;
GRANT ALL ON public.doc_number_sequences TO service_role;
ALTER TABLE public.doc_number_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY dns_admin ON public.doc_number_sequences FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Atomic next-number function (row-level lock, per-year rollover)
CREATE OR REPLACE FUNCTION public.next_doc_number(
  _org uuid, _fiscal_year integer, _doc_type text, _branch text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO public.doc_number_sequences(org_id, fiscal_year, doc_type, branch, next_seq)
  VALUES (_org, _fiscal_year, _doc_type, _branch, 1)
  ON CONFLICT (org_id, fiscal_year, doc_type, branch) DO NOTHING;

  UPDATE public.doc_number_sequences
     SET next_seq = next_seq + 1
   WHERE org_id = _org AND fiscal_year = _fiscal_year
     AND doc_type = _doc_type AND branch = _branch
   RETURNING next_seq - 1 INTO v_next;

  RETURN v_next;
END $$;

-- Seed a default VAT rule if none exist (15% KSA VAT as a safe default the admin can edit)
INSERT INTO public.tax_rules (country, region, rate_bps, kind, inclusive)
SELECT 'SA', NULL, 1500, 'vat', false
WHERE NOT EXISTS (SELECT 1 FROM public.tax_rules WHERE country = 'SA');
