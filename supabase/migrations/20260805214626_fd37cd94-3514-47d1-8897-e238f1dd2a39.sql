CREATE TABLE public.vpn_exit_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text,
  country_code text,
  relay_url text NOT NULL,
  relay_token text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown','up','degraded','down')),
  latency_ms integer,
  last_checked_at timestamptz,
  last_error text,
  request_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vpn_exit_nodes TO authenticated;
GRANT ALL ON public.vpn_exit_nodes TO service_role;
ALTER TABLE public.vpn_exit_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vpn_nodes_admin_all" ON public.vpn_exit_nodes
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER vpn_exit_nodes_touch
  BEFORE UPDATE ON public.vpn_exit_nodes
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX vpn_exit_nodes_pick ON public.vpn_exit_nodes (enabled, status, priority, latency_ms);

CREATE TABLE public.vpn_route_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid REFERENCES public.vpn_exit_nodes(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vpn_route_events TO authenticated;
GRANT ALL ON public.vpn_route_events TO service_role;
ALTER TABLE public.vpn_route_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vpn_events_admin_all" ON public.vpn_route_events
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX vpn_route_events_recent ON public.vpn_route_events (created_at DESC);