/**
 * Geo-unblock routing layer ("VPN" for streaming only).
 *
 * A real device-level VPN cannot run inside a browser, so Nova TV routes the
 * *upstream media fetch* through one of the operator's own exit servers. Each
 * exit server runs the small relay in `scripts/nova-relay.mjs`, which accepts
 *
 *     GET  {relay_url}/relay?url=<encoded upstream url>
 *     GET  {relay_url}/health
 *
 * authenticated with `x-nova-relay-token`, and streams the upstream response
 * back untouched (including redirects, so the caller keeps its own redirect
 * handling). The viewer's IP and the provider's IP never see each other.
 *
 * Server-only. Relay tokens must never reach the browser.
 */

export interface VpnExitNode {
  id: string;
  name: string;
  country: string | null;
  country_code: string | null;
  relay_url: string;
  relay_token: string;
  priority: number;
  status: string;
  latency_ms: number | null;
}

interface NodeCache {
  nodes: VpnExitNode[];
  loadedAt: number;
}

const CACHE_TTL_MS = 60_000;
let cache: NodeCache | null = null;

function supabaseConfigured(): boolean {
  return Boolean(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]);
}

/** Loads enabled exit nodes (cached). Returns [] when routing is not set up. */
export async function loadExitNodes(force = false): Promise<VpnExitNode[]> {
  if (!supabaseConfigured()) return [];
  if (!force && cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.nodes;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("vpn_exit_nodes")
      .select("id, name, country, country_code, relay_url, relay_token, priority, status, latency_ms")
      .eq("enabled", true)
      .neq("status", "down")
      .order("priority", { ascending: true })
      .order("latency_ms", { ascending: true, nullsFirst: false });
    cache = { nodes: (data ?? []) as VpnExitNode[], loadedAt: Date.now() };
    return cache.nodes;
  } catch {
    cache = { nodes: [], loadedAt: Date.now() };
    return [];
  }
}

export function invalidateExitNodeCache() {
  cache = null;
}

/** Pick the best node, optionally preferring a country code (e.g. "DE"). */
export async function pickExitNode(preferredCountry?: string | null): Promise<VpnExitNode | null> {
  const nodes = await loadExitNodes();
  if (!nodes.length) return null;
  if (preferredCountry) {
    const wanted = preferredCountry.trim().toUpperCase();
    const match = nodes.find((n) => (n.country_code ?? "").toUpperCase() === wanted);
    if (match) return match;
  }
  return nodes[0] ?? null;
}

function relayEndpoint(node: VpnExitNode, target: URL, forwardHost?: string): string {
  const base = node.relay_url.replace(/\/+$/, "");
  const url = new URL(`${base}/relay`);
  url.searchParams.set("url", target.toString());
  if (forwardHost) url.searchParams.set("host", forwardHost);
  return url.toString();
}

/**
 * Fetch `target` through an exit node when one is available, otherwise fetch
 * it directly. Always uses `redirect: "manual"` semantics from `init`.
 */
export async function routedFetch(
  target: URL,
  init: RequestInit,
  options: { forwardHost?: string; viaCountry?: string | null } = {},
): Promise<{ response: Response; node: VpnExitNode | null }> {
  const node = await pickExitNode(options.viaCountry ?? null);
  if (!node) return { response: await fetch(target, init), node: null };

  const headers = new Headers(init.headers);
  // The relay applies the Host override itself; sending it inline is rejected
  // by some runtimes.
  headers.delete("host");
  headers.set("x-nova-relay-token", node.relay_token);

  const started = Date.now();
  try {
    const response = await fetch(relayEndpoint(node, target, options.forwardHost), {
      ...init,
      headers,
    });
    if (response.status === 502 || response.status === 504) {
      void recordNodeResult(node, false, Date.now() - started, `relay upstream ${response.status}`);
      // Relay reachable but upstream failed through it — fall back to direct.
      await response.body?.cancel().catch(() => undefined);
      return { response: await fetch(target, init), node: null };
    }
    void recordNodeResult(node, true, Date.now() - started);
    return { response, node };
  } catch (e) {
    void recordNodeResult(node, false, Date.now() - started, e instanceof Error ? e.message : String(e));
    return { response: await fetch(target, init), node: null };
  }
}

let lastStatsWrite = 0;

async function recordNodeResult(node: VpnExitNode, ok: boolean, latencyMs: number, error?: string) {
  if (!supabaseConfigured()) return;
  // Throttle successful writes so byte-range storms don't hammer the database.
  if (ok && Date.now() - lastStatsWrite < 15_000) return;
  lastStatsWrite = Date.now();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("vpn_exit_nodes")
      .update({
        status: ok ? "up" : "degraded",
        latency_ms: latencyMs,
        last_checked_at: new Date().toISOString(),
        last_error: ok ? null : (error ?? "unknown"),
      } as never)
      .eq("id", node.id);
    if (!ok) {
      await supabaseAdmin.from("vpn_route_events").insert({
        node_id: node.id,
        event_type: "route_failed",
        message: error ?? null,
        latency_ms: latencyMs,
      } as never);
      invalidateExitNodeCache();
    }
  } catch {
    // best effort
  }
}

/** Probe a node's /health endpoint and persist the result. */
export async function probeExitNode(node: Pick<VpnExitNode, "id" | "relay_url" | "relay_token">): Promise<{
  ok: boolean;
  latencyMs: number;
  ip?: string;
  error?: string;
}> {
  const started = Date.now();
  try {
    const base = node.relay_url.replace(/\/+$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${base}/health`, {
      headers: { "x-nova-relay-token": node.relay_token },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return { ok: false, latencyMs, error: `HTTP ${res.status}` };
    }
    const body = (await res.json().catch(() => ({}))) as { ip?: string };
    return { ok: true, latencyMs, ...(body.ip ? { ip: body.ip } : {}) };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
