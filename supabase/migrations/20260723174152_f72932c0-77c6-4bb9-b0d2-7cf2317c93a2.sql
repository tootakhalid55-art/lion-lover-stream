
-- Drop single-device PK/unique on user_devices (Phase 1 constraint), add proper composite unique
DO $$
DECLARE con text;
BEGIN
  SELECT conname INTO con FROM pg_constraint
   WHERE conrelid = 'public.user_devices'::regclass AND contype IN ('p','u')
   ORDER BY contype = 'p' DESC LIMIT 1;
  IF con IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_devices DROP CONSTRAINT ' || quote_ident(con);
  END IF;
END $$;

ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS first_login_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS name text;

CREATE UNIQUE INDEX IF NOT EXISTS user_devices_user_device_uk ON public.user_devices(user_id, device_id);
CREATE INDEX IF NOT EXISTS user_devices_user_idx ON public.user_devices(user_id);

ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS country text;
