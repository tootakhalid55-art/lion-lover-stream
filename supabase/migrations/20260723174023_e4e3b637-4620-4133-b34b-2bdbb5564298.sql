
-- Enums
CREATE TYPE public.package_tier AS ENUM ('trial','monthly','quarterly','semi_annual','annual','lifetime','custom');
CREATE TYPE public.license_status AS ENUM ('active','expired','revoked','pending');
CREATE TYPE public.license_type AS ENUM ('trial','paid','lifetime','comp');

-- ─── packages ─────────────────────────────────────────────────────────
CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tier public.package_tier NOT NULL,
  duration_days integer,  -- null = lifetime
  max_devices integer NOT NULL DEFAULT 1,
  max_sessions integer NOT NULL DEFAULT 1,
  simultaneous_streams integer NOT NULL DEFAULT 1,
  allow_download boolean NOT NULL DEFAULT false,
  allow_recording boolean NOT NULL DEFAULT false,
  allowed_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY packages_read_active ON public.packages FOR SELECT TO authenticated USING (is_active = true OR public.is_staff(auth.uid()));
CREATE POLICY packages_admin_all ON public.packages FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER packages_touch BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ─── licenses ─────────────────────────────────────────────────────────
CREATE TABLE public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  license_key text NOT NULL UNIQUE,
  license_type public.license_type NOT NULL DEFAULT 'paid',
  status public.license_status NOT NULL DEFAULT 'active',
  activated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  auto_renew boolean NOT NULL DEFAULT false,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX licenses_user_idx ON public.licenses(user_id);
CREATE INDEX licenses_status_idx ON public.licenses(status);
CREATE INDEX licenses_expires_idx ON public.licenses(expires_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY licenses_self_read ON public.licenses FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY licenses_admin_all ON public.licenses FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER licenses_touch BEFORE UPDATE ON public.licenses FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ─── activation_codes ─────────────────────────────────────────────────
CREATE TABLE public.activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
  duration_override_days integer,
  uses_allowed integer NOT NULL DEFAULT 1,
  uses_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activation_codes_pkg_idx ON public.activation_codes(package_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activation_codes TO authenticated;
GRANT ALL ON public.activation_codes TO service_role;
ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY activation_codes_admin_all ON public.activation_codes FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER activation_codes_touch BEFORE UPDATE ON public.activation_codes FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ─── profiles: link package ───────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS profiles_package_idx ON public.profiles(package_id);

-- ─── seed default packages ────────────────────────────────────────────
INSERT INTO public.packages (name, tier, duration_days, max_devices, max_sessions, simultaneous_streams, allow_download, allow_recording, price_cents, currency, sort_order) VALUES
  ('تجريبي', 'trial', 3, 1, 1, 1, false, false, 0, 'USD', 10),
  ('أساسي', 'monthly', 30, 1, 1, 1, false, false, 999, 'USD', 20),
  ('عائلي', 'quarterly', 90, 3, 3, 2, true, false, 2499, 'USD', 30),
  ('بريميوم', 'annual', 365, 5, 5, 3, true, true, 7999, 'USD', 40),
  ('مدى الحياة', 'lifetime', NULL, 5, 5, 3, true, true, 19999, 'USD', 50);
