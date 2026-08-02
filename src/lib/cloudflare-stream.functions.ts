/**
 * Cloudflare Stream — admin server functions (Nova TV).
 * All mutating calls require `canManageSystem` and are audit-logged.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability } from "@/lib/rbac.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface CfAssetRow {
  id: string;
  kind: string;
  xtream_id: string;
  title: string | null;
  cf_uid: string | null;
  live_input_id: string | null;
  playback_hls: string | null;
  playback_dash: string | null;
  status: string;
  enabled: boolean;
  source_ext: string | null;
  error_message: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export const cfStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCapability(context, "canManageSystem");
    const { isCloudflareConfigured } = await import("./cloudflare-stream.server");
    const db = await admin();
    const [assets, nodes] = await Promise.all([
      db.from("cf_stream_assets").select("status", { count: "exact" }),
      db.from("cf_restreamer_nodes").select("node_name, active_channels, last_heartbeat_at, version").order("node_name"),
    ]);
    const byStatus: Record<string, number> = {};
    for (const r of (assets.data ?? []) as Array<{ status: string }>) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    }
    return {
      configured: isCloudflareConfigured(),
      webhookConfigured: Boolean(process.env["CLOUDFLARE_STREAM_WEBHOOK_SECRET"]),
      restreamerConfigured: Boolean(process.env["NOVA_RESTREAMER_TOKEN"]),
      total: assets.count ?? 0,
      byStatus,
      nodes: (nodes.data ?? []) as Array<{
        node_name: string;
        active_channels: number;
        last_heartbeat_at: string | null;
        version: string | null;
      }>,
    };
  });

export const listCfAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CfAssetRow[]> => {
    await assertCapability(context, "canManageSystem");
    const db = await admin();
    const { data, error } = await db
      .from("cf_stream_assets")
      .select(
        "id, kind, xtream_id, title, cf_uid, live_input_id, playback_hls, playback_dash, status, enabled, source_ext, error_message, last_seen_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as CfAssetRow[];
  });

/** Provision a Cloudflare Live Input for an Xtream live channel. */
export const provisionCfLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { xtreamId: string; title?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageSystem");
    const { getCfConfig, provisionLiveInput, liveInputPlaybackHls } = await import("./cloudflare-stream.server");
    const { writeAudit } = await import("./audit.server");
    const cfg = getCfConfig();
    const db = await admin();

    const input = await provisionLiveInput(cfg, {
      name: data.title || `nova-live-${data.xtreamId}`,
      nova_kind: "live",
      nova_xtream_id: data.xtreamId,
    });

    const row = {
      kind: "live",
      xtream_id: data.xtreamId,
      title: data.title ?? null,
      live_input_id: input.uid,
      cf_uid: input.uid,
      rtmps_url: input.rtmps?.url ?? null,
      rtmps_stream_key: input.rtmps?.streamKey ?? null,
      srt_url: input.srt?.url ?? null,
      playback_hls: liveInputPlaybackHls(input.uid, cfg),
      status: "idle",
      error_message: null,
      created_by: context.userId,
    };
    const { data: saved, error } = await db
      .from("cf_stream_assets")
      .upsert(row as never, { onConflict: "kind,xtream_id" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await db.from("cf_stream_events").insert({
      asset_id: (saved as { id: string }).id,
      event_type: "live_input_provisioned",
      message: `Live input ${input.uid} created`,
      raw: { uid: input.uid } as never,
    });
    await writeAudit({
      actorId: context.userId,
      action: "cf_stream.provision_live",
      meta: { xtreamId: data.xtreamId, liveInputId: input.uid },
    });
    return { ok: true, liveInputId: input.uid };
  });

/** Ask Cloudflare to pull and transcode an Xtream VOD title. */
export const ingestCfVod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { kind: "movie" | "series"; xtreamId: string; title?: string; ext?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageSystem");
    const { getCfConfig, ingestVodFromUrl, hlsUrlFor, dashUrlFor } = await import("./cloudflare-stream.server");
    const { getDefaultCreds, buildStreamUrl } = await import("./xtream.server");
    const { writeAudit } = await import("./audit.server");
    const cfg = getCfConfig();
    const db = await admin();

    const ext = (data.ext || "mp4").replace(/[^a-z0-9]/gi, "").toLowerCase() || "mp4";
    const sourceUrl = buildStreamUrl(getDefaultCreds(), data.kind, data.xtreamId, ext);

    let video;
    try {
      video = await ingestVodFromUrl(cfg, sourceUrl, {
        name: data.title || `nova-${data.kind}-${data.xtreamId}`,
        nova_kind: data.kind,
        nova_xtream_id: data.xtreamId,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await db.from("cf_stream_assets").upsert(
        {
          kind: data.kind,
          xtream_id: data.xtreamId,
          title: data.title ?? null,
          source_ext: ext,
          status: "errored",
          error_message: message,
          created_by: context.userId,
        } as never,
        { onConflict: "kind,xtream_id" },
      );
      throw new Error(message);
    }

    const { data: saved, error } = await db
      .from("cf_stream_assets")
      .upsert(
        {
          kind: data.kind,
          xtream_id: data.xtreamId,
          title: data.title ?? null,
          cf_uid: video.uid,
          source_ext: ext,
          playback_hls: video.playback?.hls ?? hlsUrlFor(video.uid, cfg),
          playback_dash: video.playback?.dash ?? dashUrlFor(video.uid, cfg),
          status: "provisioning",
          error_message: null,
          created_by: context.userId,
        } as never,
        { onConflict: "kind,xtream_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await db.from("cf_stream_events").insert({
      asset_id: (saved as { id: string }).id,
      event_type: "vod_ingest_started",
      message: `Copy requested → ${video.uid}`,
      raw: { uid: video.uid } as never,
    });
    await writeAudit({
      actorId: context.userId,
      action: "cf_stream.ingest_vod",
      meta: { kind: data.kind, xtreamId: data.xtreamId, uid: video.uid },
    });
    return { ok: true, uid: video.uid };
  });

/** Pull the live status of one asset from Cloudflare and persist it. */
export const refreshCfAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageSystem");
    const { getCfConfig, getVideo, getLiveInput, hlsUrlFor, dashUrlFor, liveInputPlaybackHls } =
      await import("./cloudflare-stream.server");
    const cfg = getCfConfig();
    const db = await admin();

    const { data: asset, error } = await db
      .from("cf_stream_assets")
      .select("id, kind, cf_uid, live_input_id")
      .eq("id", data.id)
      .single();
    if (error || !asset) throw new Error("Asset not found");
    const a = asset as { id: string; kind: string; cf_uid: string | null; live_input_id: string | null };

    if (a.kind === "live") {
      if (!a.live_input_id) throw new Error("No live input");
      const input = await getLiveInput(cfg, a.live_input_id);
      const state = input.status?.current?.state;
      await db
        .from("cf_stream_assets")
        .update({
          status: state === "connected" ? "live" : "idle",
          playback_hls: liveInputPlaybackHls(a.live_input_id, cfg),
          last_seen_at: new Date().toISOString(),
        } as never)
        .eq("id", a.id);
      return { ok: true, status: state ?? "idle" };
    }

    if (!a.cf_uid) throw new Error("No Cloudflare video");
    const video = await getVideo(cfg, a.cf_uid);
    const state = video.status?.state;
    await db
      .from("cf_stream_assets")
      .update({
        status: state === "ready" ? "ready" : state === "error" ? "errored" : "provisioning",
        error_message: video.status?.errorReasonText ?? null,
        playback_hls: video.playback?.hls ?? hlsUrlFor(a.cf_uid, cfg),
        playback_dash: video.playback?.dash ?? dashUrlFor(a.cf_uid, cfg),
        last_seen_at: new Date().toISOString(),
      } as never)
      .eq("id", a.id);
    return { ok: true, status: state ?? "unknown" };
  });

export const setCfAssetEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageSystem");
    const db = await admin();
    const { error } = await db.from("cf_stream_assets").update({ enabled: data.enabled } as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCfAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageSystem");
    const { getCfConfig, deleteVideo, deleteLiveInput } = await import("./cloudflare-stream.server");
    const { writeAudit } = await import("./audit.server");
    const db = await admin();

    const { data: asset } = await db
      .from("cf_stream_assets")
      .select("id, kind, cf_uid, live_input_id, xtream_id")
      .eq("id", data.id)
      .maybeSingle();
    const a = asset as { kind: string; cf_uid: string | null; live_input_id: string | null; xtream_id: string } | null;

    if (a) {
      try {
        const cfg = getCfConfig();
        if (a.kind === "live" && a.live_input_id) await deleteLiveInput(cfg, a.live_input_id);
        else if (a.cf_uid) await deleteVideo(cfg, a.cf_uid);
      } catch (e) {
        console.error("[cf-stream] remote delete failed", e instanceof Error ? e.message : e);
      }
    }
    await db.from("cf_stream_assets").delete().eq("id", data.id);
    await writeAudit({
      actorId: context.userId,
      action: "cf_stream.delete_asset",
      meta: { id: data.id, xtreamId: a?.xtream_id ?? null },
    });
    return { ok: true };
  });

export const listCfEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCapability(context, "canManageSystem");
    const db = await admin();
    const { data } = await db
      .from("cf_stream_events")
      .select("id, asset_id, event_type, message, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as Array<{
      id: string;
      asset_id: string | null;
      event_type: string;
      message: string | null;
      created_at: string;
    }>;
  });
