/**
 * Server-only Xtream Codes API client.
 * Never import from client code — filename ending in `.server.ts` is blocked
 * from client bundles.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

export interface XtreamCreds {
  serverUrl: string; // no trailing slash
  username: string;
  password: string;
}

export function getDefaultCreds(): XtreamCreds {
  const serverUrl = process.env.XTREAM_SERVER_URL?.replace(/\/+$/, "");
  const username = process.env.XTREAM_DEFAULT_USERNAME;
  const password = process.env.XTREAM_DEFAULT_PASSWORD;
  if (!serverUrl || !username || !password) {
    throw new Error("Xtream default credentials are not configured");
  }
  return { serverUrl, username, password };
}

async function xtreamFetch(url: string, opts?: { timeoutMs?: number; method?: string; headers?: HeadersInit }): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: opts?.method ?? "GET",
      signal: controller.signal,
      headers: { "User-Agent": "LionTV/1.0", ...(opts?.headers ?? {}) },
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch with retry on network / 5xx / 429. Records audit entries. */
async function fetchWithRetry(url: string, action: string, opts?: { timeoutMs?: number }): Promise<Response> {
  const { record, safeUrl } = await import("./xtream-log.server");
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const start = Date.now();
    try {
      const res = await xtreamFetch(url, opts);
      const dur = Date.now() - start;
      if (res.ok) {
        record({ ts: Date.now(), action, ok: true, status: res.status, durationMs: dur, attempt });
        return res;
      }
      const retryable = res.status >= 500 || res.status === 429;
      record({ ts: Date.now(), action, ok: false, status: res.status, durationMs: dur, attempt, error: `HTTP ${res.status} ${safeUrl(url)}` });
      if (!retryable || attempt === MAX_ATTEMPTS) return res;
    } catch (e) {
      const dur = Date.now() - start;
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      record({ ts: Date.now(), action, ok: false, durationMs: dur, attempt, error: msg });
      if (attempt === MAX_ATTEMPTS) throw e;
    }
    // Exponential backoff with jitter
    const backoff = Math.min(2000, 250 * 2 ** (attempt - 1)) + Math.random() * 150;
    await new Promise((r) => setTimeout(r, backoff));
  }
  throw lastErr ?? new Error("Upstream failed");
}

/** Call player_api.php with an action. Returns parsed JSON. */
export async function callApi<T = unknown>(
  creds: XtreamCreds,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${creds.serverUrl}/player_api.php`);
  url.searchParams.set("username", creds.username);
  url.searchParams.set("password", creds.password);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const action = String(params.action ?? "auth");
  const res = await fetchWithRetry(url.toString(), `api:${action}`);
  if (!res.ok) {
    throw new Error(`Xtream upstream returned ${res.status}`);
  }
  const text = await res.text();
  if (!text) return [] as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Xtream returned invalid JSON");
  }
}

/** Lightweight health check with short timeout. Never throws. */
export async function healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const serverUrl = process.env.XTREAM_SERVER_URL?.replace(/\/+$/, "");
    if (!serverUrl) return { ok: false, latencyMs: 0, error: "server-not-configured" };
    const res = await xtreamFetch(`${serverUrl}/player_api.php`, { timeoutMs: 5000, method: "HEAD" });
    return { ok: res.ok || res.status < 500, latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : "unknown" };
  }
}


/** Verify credentials. Returns account/server info when valid. */
export async function authenticate(creds: XtreamCreds): Promise<{
  user_info: { auth: number; status: string; username: string; exp_date?: string };
  server_info: { url: string; port: string; server_protocol: string };
}> {
  const data = await callApi<{
    user_info?: { auth?: number; status?: string; username?: string; exp_date?: string };
    server_info?: { url?: string; port?: string; server_protocol?: string };
  }>(creds);
  if (!data || !data.user_info || data.user_info.auth !== 1) {
    throw new Error("Invalid credentials");
  }
  return data as never;
}

// Raw Xtream shapes ---------------------------------------------------------

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

export interface XtreamVod {
  num: number;
  name: string;
  stream_id: number;
  stream_icon?: string;
  rating?: string | number;
  rating_5based?: number;
  added?: string;
  category_id?: string;
  container_extension?: string;
  year?: string;
}

export interface XtreamSeries {
  num: number;
  name: string;
  series_id: number;
  cover?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  releaseDate?: string;
  last_modified?: string;
  rating?: string | number;
  rating_5based?: number;
  backdrop_path?: string[];
  youtube_trailer?: string;
  category_id?: string;
}

export interface XtreamLive {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon?: string;
  epg_channel_id?: string;
  category_id?: string;
}

export const xtream = {
  getLiveCategories: (c: XtreamCreds) =>
    callApi<XtreamCategory[]>(c, { action: "get_live_categories" }),
  getVodCategories: (c: XtreamCreds) =>
    callApi<XtreamCategory[]>(c, { action: "get_vod_categories" }),
  getSeriesCategories: (c: XtreamCreds) =>
    callApi<XtreamCategory[]>(c, { action: "get_series_categories" }),
  getLiveStreams: (c: XtreamCreds, categoryId?: string) =>
    callApi<XtreamLive[]>(c, { action: "get_live_streams", category_id: categoryId }),
  getVodStreams: (c: XtreamCreds, categoryId?: string) =>
    callApi<XtreamVod[]>(c, { action: "get_vod_streams", category_id: categoryId }),
  getSeriesList: (c: XtreamCreds, categoryId?: string) =>
    callApi<XtreamSeries[]>(c, { action: "get_series", category_id: categoryId }),
  getVodInfo: (c: XtreamCreds, vodId: number) =>
    callApi<{ info?: Record<string, unknown>; movie_data?: Record<string, unknown> }>(c, {
      action: "get_vod_info",
      vod_id: vodId,
    }),
  getSeriesInfo: (c: XtreamCreds, seriesId: number) =>
    callApi<{
      info?: Record<string, unknown>;
      episodes?: Record<string, unknown[]>;
    }>(c, { action: "get_series_info", series_id: seriesId }),
};

/** Build a stream URL. These contain credentials — never send to client. */
export function buildStreamUrl(
  creds: XtreamCreds,
  kind: "movie" | "live" | "series",
  streamId: number | string,
  ext = "mp4",
): string {
  const path = kind === "live" ? "live" : kind;
  return `${creds.serverUrl}/${path}/${encodeURIComponent(creds.username)}/${encodeURIComponent(
    creds.password,
  )}/${streamId}.${ext}`;
}
