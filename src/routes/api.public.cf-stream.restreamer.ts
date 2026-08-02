/**
 * Restreamer control plane (VPS ffmpeg worker ↔ Nova TV).
 *
 * GET  → roster of live channels to push into Cloudflare, with the Xtream
 *        source URL and the RTMPS push target for each.
 * POST → worker heartbeat (node name, version, active channel count).
 *
 * Security: `Authorization: Bearer <NOVA_RESTREAMER_TOKEN>`. The response
 * carries push keys and upstream credentials, so it must never be public.
 */
import { createFileRoute } from "@tanstack/react-router";

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorize(request: Request): boolean {
  const token = process.env["NOVA_RESTREAMER_TOKEN"];
  if (!token) return false;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return provided.length > 0 && timingSafeEqualStr(provided, token);
}

export const Route = createFileRoute("/api/public/cf-stream/restreamer")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorize(request)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { getDefaultCreds, buildStreamUrl } = await import("@/lib/xtream.server");

        const { data, error } = await supabaseAdmin
          .from("cf_stream_assets")
          .select("id, xtream_id, title, rtmps_url, rtmps_stream_key, srt_url, status")
          .eq("kind", "live")
          .eq("enabled", true)
          .not("rtmps_url", "is", null);
        if (error) return new Response(error.message, { status: 500 });

        const creds = getDefaultCreds();
        const channels = (data ?? []).map((r: any) => ({
          id: r.id,
          xtreamId: r.xtream_id,
          title: r.title,
          sourceUrl: buildStreamUrl(creds, "live", r.xtream_id, "ts"),
          rtmpsUrl: r.rtmps_url,
          rtmpsStreamKey: r.rtmps_stream_key,
          srtUrl: r.srt_url,
          status: r.status,
        }));

        return new Response(JSON.stringify({ channels, generatedAt: new Date().toISOString() }), {
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },

      POST: async ({ request }) => {
        if (!authorize(request)) return new Response("Unauthorized", { status: 401 });

        let body: { nodeName?: string; version?: string; activeChannels?: number; meta?: unknown };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const nodeName = String(body.nodeName ?? "").slice(0, 80);
        if (!nodeName) return new Response("nodeName is required", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("cf_restreamer_nodes").upsert(
          {
            node_name: nodeName,
            version: body.version ? String(body.version).slice(0, 40) : null,
            active_channels: Number.isFinite(Number(body.activeChannels)) ? Number(body.activeChannels) : 0,
            last_heartbeat_at: new Date().toISOString(),
            meta: (body.meta ?? {}) as never,
          } as never,
          { onConflict: "node_name" },
        );
        if (error) return new Response(error.message, { status: 500 });
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      },

      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
