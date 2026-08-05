#!/usr/bin/env node
/**
 * Nova TV — exit-node relay ("VPN" hop for streaming).
 *
 * Run this on each of your exit servers (any country). Nova TV's stream proxy
 * calls it, and it performs the upstream fetch from THIS machine's IP, so the
 * provider sees the exit server instead of the app server, and the viewer
 * never sees the provider.
 *
 * Endpoints
 *   GET /health                      → { ok, ip, version }
 *   GET /relay?url=<enc>&host=<opt>  → streams the upstream response as-is
 *
 * Auth: header `x-nova-relay-token: <NOVA_RELAY_TOKEN>` on every request.
 *
 * Usage:
 *   NOVA_RELAY_TOKEN=... PORT=8787 node scripts/nova-relay.mjs
 *
 * systemd unit (recommended):
 *   [Service]
 *   Environment=NOVA_RELAY_TOKEN=...
 *   Environment=PORT=8787
 *   ExecStart=/usr/bin/node /srv/nova-relay/nova-relay.mjs
 *   Restart=always
 *
 * Put it behind nginx + TLS and register the https URL in Nova TV
 * (لوحة التحكم ← تجاوز الحجب).
 */
import http from "node:http";

const TOKEN = process.env.NOVA_RELAY_TOKEN;
const PORT = Number(process.env.PORT || 8787);
const VERSION = "1.0.0";
const MAX_BODY_TIMEOUT_MS = 120_000;

if (!TOKEN) {
  console.error("NOVA_RELAY_TOKEN is required");
  process.exit(1);
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "x-nova-relay-token",
]);

function authorized(req) {
  const provided = req.headers["x-nova-relay-token"];
  if (typeof provided !== "string" || provided.length !== TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < TOKEN.length; i++) diff |= provided.charCodeAt(i) ^ TOKEN.charCodeAt(i);
  return diff === 0;
}

let cachedIp = null;
async function publicIp() {
  if (cachedIp) return cachedIp;
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(5000) });
    cachedIp = (await res.json()).ip;
  } catch {
    cachedIp = null;
  }
  return cachedIp;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (!authorized(req)) {
    res.writeHead(401, { "content-type": "text/plain" });
    res.end("Unauthorized");
    return;
  }

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ip: await publicIp(), version: VERSION }));
    return;
  }

  if (url.pathname !== "/relay") {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
    return;
  }

  const targetRaw = url.searchParams.get("url");
  if (!targetRaw) {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("url is required");
    return;
  }

  let target;
  try {
    target = new URL(targetRaw);
    if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error("bad protocol");
  } catch {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("Invalid url");
    return;
  }

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    if (typeof v === "string") headers[k] = v;
  }
  const hostOverride = url.searchParams.get("host");
  if (hostOverride) headers["host"] = hostOverride;
  headers["user-agent"] = headers["user-agent"] || "NovaTV/1.0";

  try {
    const upstream = await fetch(target, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(MAX_BODY_TIMEOUT_MS),
    });

    const outHeaders = {};
    upstream.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      outHeaders[key] = value;
    });
    res.writeHead(upstream.status, outHeaders);

    if (!upstream.body || req.method === "HEAD") {
      res.end();
      return;
    }
    const reader = upstream.body.getReader();
    req.on("close", () => reader.cancel().catch(() => {}));
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) {
        await new Promise((r) => res.once("drain", r));
      }
    }
    res.end();
  } catch (e) {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain" });
    }
    res.end(`Upstream error: ${e?.message ?? "unknown"}`);
  }
});

server.listen(PORT, () => console.log(`nova-relay ${VERSION} listening on :${PORT}`));
