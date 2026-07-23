
-- Extend app_role enum with new roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'readonly';

-- Devices: add missing columns
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS trusted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- Sessions: add revoked_by/reason
ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS revoked_by uuid,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

-- Profiles: reauth_after (for force re-auth)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reauth_after timestamptz;

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  severity text NOT NULL DEFAULT 'info',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_broadcast_idx ON public.notifications(created_at DESC) WHERE user_id IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_owner_read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL OR public.is_staff(auth.uid()));
CREATE POLICY "notifications_owner_update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "notifications_admin_write" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "notifications_admin_delete" ON public.notifications FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Security events
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  ip text,
  user_agent text,
  country text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_kind_idx ON public.security_events(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_user_idx ON public.security_events(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security_events_staff_read" ON public.security_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR user_id = auth.uid());

-- System health snapshots
CREATE TABLE IF NOT EXISTS public.system_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taken_at timestamptz NOT NULL DEFAULT now(),
  db_ok boolean NOT NULL,
  api_latency_ms integer,
  active_sessions integer,
  failed_jobs integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS system_health_taken_idx ON public.system_health_snapshots(taken_at DESC);
GRANT SELECT ON public.system_health_snapshots TO authenticated;
GRANT ALL ON public.system_health_snapshots TO service_role;
ALTER TABLE public.system_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_health_admin_read" ON public.system_health_snapshots FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Extend audit_logs with before/after snapshots
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS before_value jsonb,
  ADD COLUMN IF NOT EXISTS after_value jsonb,
  ADD COLUMN IF NOT EXISTS user_agent text;

-- RBAC helper
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = ANY(_roles)
  )
$$;
