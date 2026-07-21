/**
 * Stream proxy — forwards media bytes from the Xtream server using
 * server-side credentials. The credentials never touch the client.
 * Under /api/public/* so it works without auth on published builds.
 */
import { createFileRoute } from "@tanstack/react-router";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function maskUsername(u: string): string {
  if (!u) return "";
  if (u.length <= 4) return "*".repeat(u.length);
  return `${u.slice(0, 1)}${"*".repeat(u.length - 3)}${u.slice(-2)}`;
}

function streamOriginFallbacks(serverUrl: string): string[] {
  const origins = [serverUrl.replace(/\/+$/, "")];
  try {
    const url = new URL(serverUrl);
    if (url.protocol === "http:") {
      const httpsOrigin = `https://${url.hostname}`;
      if (!origins.includes(httpsOrigin)) origins.push(httpsOrigin);
    }
  } catch {
    /* ignore malformed optional fallback */
  }
  return origins;
}

function buildStreamCandidates(
  creds: { serverUrl: string; username: string; password: string },
  kind: "movie" | "series" | "live",
  id: string,
  ext: string,
): string[] {
  const path = kind === "live" ? "live" : kind;
  return streamOriginFallbacks(creds.serverUrl).map(
    (origin) =>
      `${origin}/${path}/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${id}.${ext}`,
  );
}

function sanitizeExt(value: string | null | undefined, fallback: string): string {
  const ext = String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return ext || fallback;
}

function isValidHlsManifest(text: string): boolean {
  return text.trimStart().startsWith("#EXTM3U");
}

function syntheticVodManifest(kind: "movie" | "series", id: string, sourceExt: string): string {
  const segment = `/api/public/stream/${kind}/${encodeURIComponent(id)}.ts?sourceExt=${encodeURIComponent(sourceExt)}`;
  return [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-PLAYLIST-TYPE:VOD",
    "#EXT-X-INDEPENDENT-SEGMENTS",
    "#EXT-X-TARGETDURATION:21600",
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXTINF:21600.000,",
    segment,
    "#EXT-X-ENDLIST",
    "",
  ].join("\n");
}

function rewriteManifestUrls(text: string, kind: "movie" | "series" | "live", id: string, sourceExt: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      try {
        const url = new URL(trimmed);
        const file = url.pathname.split("/").filter(Boolean).pop() || `${id}.ts`;
        const dot = file.lastIndexOf(".");
        const ext = dot > -1 ? file.slice(dot + 1) : "ts";
        const safeFile = /^\d+\.[a-z0-9]+$/i.test(file) ? file : `${id}.${ext}`;
        return `/api/public/stream/${kind}/${safeFile}?sourceExt=${encodeURIComponent(sourceExt)}`;
      } catch {
        return `/api/public/stream/${kind}/${encodeURIComponent(id)}.ts?sourceExt=${encodeURIComponent(sourceExt)}`;
      }
    })
    .join("\n");
}

async function proxy(request: Request, kind: "movie" | "series" | "live", fileName: string) {
  const { xtream, authenticate } = await import("@/lib/xtream.server");
  const { resolveCreds } = await import("@/lib/xtream-session.server");
  const { rateLimit, clientKey } = await import("@/lib/rate-limit.server");
  const { record, safeUrl } = await import("@/lib/xtream-log.server");

  // Rate-limit per client IP: 60 requests / minute, burst 20.
  const rl = rateLimit(`stream:${clientKey(request)}`, { capacity: 20, refillPerSec: 1 });
  if (!rl.allowed) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) },
    });
  }

  const requestUrl = new URL(request.url);
  const dot = fileName.lastIndexOf(".");
  const id = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = sanitizeExt(dot > 0 ? fileName.slice(dot + 1) : undefined, "mp4");
  if (!/^\d+$/.test(id)) return new Response("Bad id", { status: 400 });

  const sourceExt = sanitizeExt(requestUrl.searchParams.get("sourceExt"), kind === "live" ? "ts" : "mp4");

  const { creds, isOverride } = await resolveCreds();
  if (ext === "m3u8") {
    // VOD/episode `.m3u8` endpoints on many Xtream panels either return an
    // empty manifest or consume one of the account's limited stream slots. Do
    // not probe upstream for VOD. Generate a local HLS wrapper directly so iOS
    // Safari has a native fallback while desktop browsers use MPEG-TS/MSE.
    if (kind === "movie" || kind === "series") {
      console.log(`[stream:hls] generated local VOD manifest ${kind}/${id}.m3u8 sourceExt=${sourceExt}`);
      return new Response(syntheticVodManifest(kind, id, sourceExt), {
        status: 200,
        headers: {
          "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
        },
      });
    }

    const manifestCandidates = buildStreamCandidates(creds, kind, id, "m3u8");
    for (const candidate of manifestCandidates) {
      try {
        const res = await fetch(candidate, {
          method: "GET",
          headers: { "user-agent": "VLC/3.0.20 LibVLC/3.0.20", accept: "application/vnd.apple.mpegurl,*/*" },
          redirect: "follow",
        });
        const body = await res.text().catch(() => "");
        if ((res.ok || res.status === 206) && isValidHlsManifest(body)) {
          console.log(`[stream:hls] upstream manifest ok ${kind}/${id}.m3u8 via ${safeUrl(candidate)}`);
          return new Response(rewriteManifestUrls(body, kind, id, sourceExt), {
            status: 200,
            headers: {
              "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
              "cache-control": "no-store",
              "access-control-allow-origin": "*",
            },
          });
        }
        console.warn(`[stream:hls] upstream manifest invalid ${kind}/${id}.m3u8 status=${res.status} bytes=${body.length}`);
      } catch (e) {
        console.warn(`[stream:hls] upstream manifest failed ${kind}/${id}.m3u8 err=${e instanceof Error ? e.message : String(e)}`);
      }
    }

  }

  const upstreamExt = ext === "ts" ? sourceExt : ext;
  const upstreamCandidates = buildStreamCandidates(creds, kind, id, upstreamExt);
  const safe = safeUrl(upstreamCandidates[0]);
  const maskedUser = maskUsername(creds.username);
  const accountLabel = isOverride ? "user-override" : "default";

  // ─── Auth + bouquet diagnostics (per playback request) ────────────────
  console.log(
    `[stream:auth] server=${creds.serverUrl} user=${maskedUser} account=${accountLabel} media=${kind}:${id}.${ext} upstreamExt=${upstreamExt}`,
  );
  try {
    const authInfo = await authenticate(creds);
    console.log(
      `[stream:auth] ok status=${authInfo.user_info.status} exp=${authInfo.user_info.exp_date ?? "-"}`,
    );
  } catch (e) {
    console.warn(
      `[stream:auth] FAIL user=${maskedUser} account=${accountLabel} err=${e instanceof Error ? e.message : String(e)}`,
    );
  }
  // Bouquet membership check (best-effort, cheap on cache miss only)
  try {
    const numId = Number(id);
    let inBouquet: boolean | "unknown" = "unknown";
    if (kind === "movie") {
      const list = await xtream.getVodStreams(creds).catch(() => []);
      inBouquet = list.some((v) => v.stream_id === numId);
    } else if (kind === "live") {
      const list = await xtream.getLiveStreams(creds).catch(() => []);
      inBouquet = list.some((v) => v.stream_id === numId);
    }
    // For series episodes, id is an episode id, not a series_id — skip.
    console.log(`[stream:bouquet] media=${kind}:${id} inBouquet=${inBouquet} url=${safe}`);
  } catch {
    /* ignore diagnostics failures */
  }

  const forwardHeaders = new Headers();
  const range = request.headers.get("range");
  if (range) forwardHeaders.set("range", range);
  forwardHeaders.set("user-agent", "VLC/3.0.20 LibVLC/3.0.20");
  forwardHeaders.set("accept", "*/*");
  forwardHeaders.set("icy-metadata", "1");

  // Retry transient failures on non-Range initial requests only. Range
  // requests support natural resume — the player retries the offset.
  const maxAttempts = range ? 1 : 3;
  let upstreamRes: Response | null = null;
  let lastErr: unknown;
  let lastErrorBody = "";
  let usedUpstream = upstreamCandidates[0];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const start = Date.now();
    try {
      for (const candidate of upstreamCandidates) {
        usedUpstream = candidate;
        upstreamRes = await fetch(candidate, {
          // Some Xtream servers return non-standard codes for HEAD. Always GET.
          method: "GET",
          headers: forwardHeaders,
          redirect: "follow",
        });

        if (upstreamRes.status !== 401 && upstreamRes.status !== 403) break;

        lastErrorBody = (await upstreamRes.clone().text().catch(() => "")).slice(0, 300);
        const hasFallback = upstreamCandidates.indexOf(candidate) < upstreamCandidates.length - 1;
        console.warn(
          `[stream] auth rejected by ${safeUrl(candidate)} status=${upstreamRes.status}${lastErrorBody ? ` body=${lastErrorBody}` : ""}${hasFallback ? " — trying HTTPS fallback" : ""}`,
        );
        if (!hasFallback) break;
      }
      if (!upstreamRes) throw new Error("No upstream response");
      const response = upstreamRes;
      const dur = Date.now() - start;
      const transient = response.status >= 500 || response.status === 429;
      console.log(`[stream] ${kind}/${id}.${ext} → ${safeUrl(usedUpstream)} :: ${response.status} (${dur}ms, attempt ${attempt})`);
      record({
        ts: Date.now(),
        action: `stream:${kind}`,
        ok: response.ok || response.status === 206,
        status: response.status,
        durationMs: dur,
        attempt,
        error: response.ok || response.status === 206 ? undefined : `HTTP ${response.status} ${safeUrl(usedUpstream)}`,
      });
      if (!transient || attempt === maxAttempts) break;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[stream] ${kind}/${id}.${ext} → ${safeUrl(usedUpstream)} :: fetch failed (attempt ${attempt}): ${msg}`);
      record({
        ts: Date.now(),
        action: `stream:${kind}`,
        ok: false,
        durationMs: Date.now() - start,
        attempt,
        error: msg,
      });
      if (attempt === maxAttempts) break;
    }
    await new Promise((r) => setTimeout(r, 300 * attempt));
  }

  if (!upstreamRes) {
    return new Response(`Upstream unreachable: ${lastErr instanceof Error ? lastErr.message : "network error"}`, {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Surface upstream error codes clearly so the player can display them.
  const status = upstreamRes.status;
  if (status !== 200 && status !== 206) {
    const body = lastErrorBody || (await upstreamRes.text().catch(() => ""));
    const trimmed = body.slice(0, 300).replace(/<[^>]+>/g, "").trim();
    const label =
      status === 401 || status === 403
        ? "Unauthorized: Xtream account rejected"
        : status === 404
          ? "Media not found on upstream"
          : status === 422
            ? "Invalid media id / not in bouquet"
            : `Upstream HTTP ${status}`;
    console.warn(`[stream] non-2xx: ${label}${trimmed ? ` — ${trimmed}` : ""}`);
    return new Response(`${label}${trimmed ? ` — ${trimmed}` : ""}`, {
      status,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const respHeaders = new Headers();
  upstreamRes.headers.forEach((v, k) => {
    if (!HOP_BY_HOP.has(k.toLowerCase())) respHeaders.set(k, v);
  });
  respHeaders.set("cache-control", "no-store");
  // Normalize: some Xtream servers return `accept-ranges: 0-<size>` which
  // is non-standard and confuses players. Force the canonical value.
  respHeaders.set("accept-ranges", "bytes");
  // Ensure a sensible content-type for common formats when upstream is vague.
  const ct = respHeaders.get("content-type") || "";
  if (!ct || ct === "application/octet-stream") {
    if (ext === "m3u8") respHeaders.set("content-type", "application/vnd.apple.mpegurl");
    else if (ext === "ts") respHeaders.set("content-type", "video/mp2t");
    else if (ext === "mp4") respHeaders.set("content-type", "video/mp4");
    else if (ext === "mkv") respHeaders.set("content-type", "video/x-matroska");
  }
  if (ext === "ts") respHeaders.set("content-type", "video/mp2t");
  respHeaders.set("access-control-allow-origin", "*");

  return new Response(upstreamRes.body, {
    status,
    statusText: upstreamRes.statusText,
    headers: respHeaders,
  });
}


export const Route = createFileRoute("/api/public/stream/$kind/$file")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const kind = params.kind;
        if (kind !== "movie" && kind !== "series" && kind !== "live") {
          return new Response("Not found", { status: 404 });
        }
        return proxy(request, kind, params.file);
      },
      HEAD: async ({ request, params }) => {
        const kind = params.kind;
        if (kind !== "movie" && kind !== "series" && kind !== "live") {
          return new Response(null, { status: 404 });
        }
        const dot = params.file.lastIndexOf(".");
        const ext = sanitizeExt(dot > 0 ? params.file.slice(dot + 1) : undefined, "mp4");
        const headers = new Headers({
          "accept-ranges": "bytes",
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
        });
        if (ext === "m3u8") headers.set("content-type", "application/vnd.apple.mpegurl");
        else if (ext === "ts") headers.set("content-type", "video/mp2t");
        else if (ext === "mp4") headers.set("content-type", "video/mp4");
        else if (ext === "mkv") headers.set("content-type", "video/x-matroska");
        return new Response(null, { status: 200, headers });
      },
    },
  },
});
