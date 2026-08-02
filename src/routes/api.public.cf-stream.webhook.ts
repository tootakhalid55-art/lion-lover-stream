/**
 * Cloudflare Stream webhook receiver.
 * Cloudflare notifies us when a copied VOD finishes transcoding (or fails)
 * and when a live input connects/disconnects.
 *
 * Security: HMAC signature verification against CLOUDFLARE_STREAM_WEBHOOK_SECRET.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cf-stream/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CLOUDFLARE_STREAM_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const rawBody = await request.text();
        const { verifyCfWebhookSignature } = await import("@/lib/cloudflare-stream.server");
        const ok = await verifyCfWebhookSignature(
          request.headers.get("webhook-signature"),
          rawBody,
          secret,
        );
        if (!ok) return new Response("Invalid signature", { status: 401 });

        let payload: Record<string, any>;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const uid: string | undefined = payload["uid"] ?? payload["input_id"];
        if (!uid) return new Response("ok");

        const { data: asset } = await supabaseAdmin
          .from("cf_stream_assets")
          .select("id, kind")
          .or(`cf_uid.eq.${uid},live_input_id.eq.${uid}`)
          .maybeSingle();

        const state: string | undefined =
          payload["status"]?.state ?? payload["event_type"] ?? payload["state"];

        let status: string | null = null;
        if (state === "ready") status = "ready";
        else if (state === "error") status = "errored";
        else if (state === "live_input.connected") status = "live";
        else if (state === "live_input.disconnected") status = "idle";

        if (asset) {
          const a = asset as { id: string; kind: string };
          if (status) {
            await supabaseAdmin
              .from("cf_stream_assets")
              .update({
                status,
                error_message: payload["status"]?.errorReasonText ?? null,
                playback_hls: payload["playback"]?.hls ?? undefined,
                playback_dash: payload["playback"]?.dash ?? undefined,
                last_seen_at: new Date().toISOString(),
              } as never)
              .eq("id", a.id);
          }
          await supabaseAdmin.from("cf_stream_events").insert({
            asset_id: a.id,
            event_type: String(state ?? "unknown"),
            message: payload["status"]?.errorReasonText ?? null,
            raw: payload as never,
          });
        }

        return new Response("ok");
      },
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
