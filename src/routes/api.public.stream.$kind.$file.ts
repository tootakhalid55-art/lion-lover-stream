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

  const upstreamRes = await fetch(upstream, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers: forwardHeaders,
    redirect: "follow",
  });

  const respHeaders = new Headers();
  upstreamRes.headers.forEach((v, k) => {
    if (!HOP_BY_HOP.has(k.toLowerCase())) respHeaders.set(k, v);
  });
  respHeaders.set("cache-control", "no-store");

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
