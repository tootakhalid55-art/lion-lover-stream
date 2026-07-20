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

async function proxy(request: Request, kind: "movie" | "series" | "live", fileName: string) {
  const { buildStreamUrl } = await import("@/lib/xtream.server");
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

  const dot = fileName.lastIndexOf(".");
  const id = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot + 1) : "mp4";
  if (!/^\d+$/.test(id)) return new Response("Bad id", { status: 400 });

  const { creds } = await resolveCreds();
  const upstream = buildStreamUrl(creds, kind, id, ext);

  const forwardHeaders = new Headers();
  const range = request.headers.get("range");
  if (range) forwardHeaders.set("range", range);
  forwardHeaders.set("user-agent", "LionTV/1.0");

  // Retry transient failures on non-Range initial requests only. Range
  // requests support natural resume — the player retries the offset.
  const maxAttempts = range ? 1 : 3;
  let upstreamRes: Response | null = null;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const start = Date.now();
    try {
      upstreamRes = await fetch(upstream, {
        method: request.method === "HEAD" ? "HEAD" : "GET",
        headers: forwardHeaders,
        redirect: "follow",
      });
      const dur = Date.now() - start;
      const transient = upstreamRes.status >= 500 || upstreamRes.status === 429;
      record({
        ts: Date.now(),
        action: `stream:${kind}`,
        ok: upstreamRes.ok || upstreamRes.status === 206,
        status: upstreamRes.status,
        durationMs: dur,
        attempt,
        error: upstreamRes.ok ? undefined : `HTTP ${upstreamRes.status} ${safeUrl(upstream)}`,
      });
      if (!transient || attempt === maxAttempts) break;
    } catch (e) {
      lastErr = e;
      record({
        ts: Date.now(),
        action: `stream:${kind}`,
        ok: false,
        durationMs: Date.now() - start,
        attempt,
        error: e instanceof Error ? e.message : String(e),
      });
      if (attempt === maxAttempts) break;
    }
    await new Promise((r) => setTimeout(r, 300 * attempt));
  }

  if (!upstreamRes) {
    return new Response("الوسائط غير متاحة حالياً", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (upstreamRes.status === 404) {
    return new Response("الوسائط غير موجودة", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const respHeaders = new Headers();
  upstreamRes.headers.forEach((v, k) => {
    if (!HOP_BY_HOP.has(k.toLowerCase())) respHeaders.set(k, v);
  });
  respHeaders.set("cache-control", "no-store");
  // Explicitly advertise range support so players know they can resume.
  if (!respHeaders.has("accept-ranges")) respHeaders.set("accept-ranges", "bytes");

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
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
        return proxy(request, kind, params.file);
      },
    },
  },
});
