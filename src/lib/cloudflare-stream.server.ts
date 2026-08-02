/**
 * Cloudflare Stream API client (server-only).
 *
 * Two delivery paths:
 *  - VOD  (movie / series episode): "copy from URL" ingest. Cloudflare pulls
 *    the signed Xtream URL once, transcodes it, and serves adaptive HLS/DASH.
 *  - LIVE (channel): Cloudflare cannot pull from Xtream. We provision a Live
 *    Input and hand the RTMPS/SRT endpoint to the VPS restreamer worker,
 *    which pushes the Xtream TS feed into Cloudflare with ffmpeg.
 */

const API_BASE = "https://api.cloudflare.com/client/v4";

export interface CfConfig {
  accountId: string;
  apiToken: string;
  customerSubdomain?: string;
}

export function getCfConfig(): CfConfig {
  const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
  const apiToken = process.env["CLOUDFLARE_STREAM_API_TOKEN"];
  if (!accountId || !apiToken) {
    throw new Error("Cloudflare Stream is not configured (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_STREAM_API_TOKEN)");
  }
  return {
    accountId,
    apiToken,
    ...(process.env["CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN"]
      ? { customerSubdomain: process.env["CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN"] }
      : {}),
  };
}

export function isCloudflareConfigured(): boolean {
  return Boolean(process.env["CLOUDFLARE_ACCOUNT_ID"] && process.env["CLOUDFLARE_STREAM_API_TOKEN"]);
}

interface CfEnvelope<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
  messages?: unknown[];
}

async function cfFetch<T>(
  cfg: CfConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}/accounts/${cfg.accountId}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${cfg.apiToken}`,
      "content-type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let body: CfEnvelope<T> | null = null;
  try {
    body = text ? (JSON.parse(text) as CfEnvelope<T>) : null;
  } catch {
    // fall through
  }
  if (!res.ok || !body?.success) {
    const detail = body?.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") || text.slice(0, 500);
    throw new Error(`Cloudflare Stream request failed [${res.status}] ${detail}`);
  }
  return body.result;
}

// ─── Playback URLs ────────────────────────────────────────────────────────

export function hlsUrlFor(uid: string, cfg: CfConfig): string {
  const sub = cfg.customerSubdomain || "customer-cloudflarestream-com";
  return `https://${sub}.cloudflarestream.com/${uid}/manifest/video.m3u8`;
}

export function dashUrlFor(uid: string, cfg: CfConfig): string {
  const sub = cfg.customerSubdomain || "customer-cloudflarestream-com";
  return `https://${sub}.cloudflarestream.com/${uid}/manifest/video.mpd`;
}

// ─── VOD ingest ───────────────────────────────────────────────────────────

export interface CfVideo {
  uid: string;
  status?: { state?: string; errorReasonText?: string; pctComplete?: string };
  playback?: { hls?: string; dash?: string };
  meta?: Record<string, unknown>;
}

/** Ask Cloudflare to pull a remote source URL and transcode it. */
export async function ingestVodFromUrl(
  cfg: CfConfig,
  sourceUrl: string,
  meta: Record<string, string>,
): Promise<CfVideo> {
  return cfFetch<CfVideo>(cfg, "/stream/copy", {
    method: "POST",
    body: JSON.stringify({ url: sourceUrl, meta, requireSignedURLs: false }),
  });
}

export async function getVideo(cfg: CfConfig, uid: string): Promise<CfVideo> {
  return cfFetch<CfVideo>(cfg, `/stream/${encodeURIComponent(uid)}`, { method: "GET" });
}

export async function deleteVideo(cfg: CfConfig, uid: string): Promise<void> {
  const res = await fetch(`${API_BASE}/accounts/${cfg.accountId}/stream/${encodeURIComponent(uid)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${cfg.apiToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Cloudflare delete failed [${res.status}] ${(await res.text()).slice(0, 300)}`);
  }
}

// ─── Live inputs ──────────────────────────────────────────────────────────

export interface CfLiveInput {
  uid: string;
  rtmps?: { url?: string; streamKey?: string };
  srt?: { url?: string; streamId?: string; passphrase?: string };
  status?: { current?: { state?: string } } | null;
  meta?: Record<string, unknown>;
}

export async function provisionLiveInput(
  cfg: CfConfig,
  meta: Record<string, string>,
): Promise<CfLiveInput> {
  return cfFetch<CfLiveInput>(cfg, "/stream/live_inputs", {
    method: "POST",
    body: JSON.stringify({
      meta,
      recording: { mode: "off", requireSignedURLs: false },
    }),
  });
}

export async function getLiveInput(cfg: CfConfig, uid: string): Promise<CfLiveInput> {
  return cfFetch<CfLiveInput>(cfg, `/stream/live_inputs/${encodeURIComponent(uid)}`, { method: "GET" });
}

export async function deleteLiveInput(cfg: CfConfig, uid: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/accounts/${cfg.accountId}/stream/live_inputs/${encodeURIComponent(uid)}`,
    { method: "DELETE", headers: { authorization: `Bearer ${cfg.apiToken}` } },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Cloudflare delete live input failed [${res.status}] ${(await res.text()).slice(0, 300)}`);
  }
}

/** Live inputs deliver playback under the live input uid. */
export function liveInputPlaybackHls(uid: string, cfg: CfConfig): string {
  const sub = cfg.customerSubdomain || "customer-cloudflarestream-com";
  return `https://${sub}.cloudflarestream.com/${uid}/manifest/video.m3u8`;
}

// ─── Webhook signature ────────────────────────────────────────────────────

/**
 * Cloudflare Stream sends `Webhook-Signature: time=<ts>,sig1=<hex hmac>`
 * where the signed payload is `<ts>.<raw body>`.
 */
export async function verifyCfWebhookSignature(
  header: string | null,
  rawBody: string,
  secret: string,
  toleranceSec = 300,
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const time = Number(parts["time"]);
  const sig = parts["sig1"];
  if (!time || !sig) return false;
  if (Math.abs(Date.now() / 1000 - time) > toleranceSec) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${time}.${rawBody}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
