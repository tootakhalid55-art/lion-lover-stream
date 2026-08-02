CREATE TABLE public.cf_stream_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('live','movie','series')),
  xtream_id text NOT NULL,
  title text,
  cf_uid text,
  live_input_id text,
  rtmps_url text,
  rtmps_stream_key text,
  srt_url text,
  playback_hls text,
  playback_dash text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','provisioning','ready','live','idle','errored','disabled')),
  enabled boolean NOT NULL DEFAULT true,
  source_ext text,
  error_message text,
  last_seen_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, xtream_id)
);

GRANT SELECT ON public.cf_stream_assets TO authenticated;
GRANT ALL ON public.cf_stream_assets TO service_role;
ALTER TABLE public.cf_stream_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cf_assets_admin_all" ON public.cf_stream_assets
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER cf_stream_assets_touch
  BEFORE UPDATE ON public.cf_stream_assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX cf_stream_assets_lookup ON public.cf_stream_assets (kind, xtream_id, status);

CREATE TABLE public.cf_stream_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.cf_stream_assets(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cf_stream_events TO authenticated;
GRANT ALL ON public.cf_stream_events TO service_role;
ALTER TABLE public.cf_stream_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cf_events_admin_all" ON public.cf_stream_events
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX cf_stream_events_asset ON public.cf_stream_events (asset_id, created_at DESC);

CREATE TABLE public.cf_restreamer_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_name text NOT NULL UNIQUE,
  version text,
  active_channels integer NOT NULL DEFAULT 0,
  last_heartbeat_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cf_restreamer_nodes TO authenticated;
GRANT ALL ON public.cf_restreamer_nodes TO service_role;
ALTER TABLE public.cf_restreamer_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cf_nodes_admin_all" ON public.cf_restreamer_nodes
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER cf_restreamer_nodes_touch
  BEFORE UPDATE ON public.cf_restreamer_nodes
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();