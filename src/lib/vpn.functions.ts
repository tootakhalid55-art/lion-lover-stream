/**
 * Geo-unblock exit nodes — admin server functions.
 * Relay tokens are never returned to the browser.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability } from "@/lib/rbac.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface VpnNodeView {
  id: string;
  name: string;
  country: string | null;
  country_code: string | null;
  relay_url: string;
  priority: number;
  enabled: boolean;
  status: string;
  latency_ms: number | null;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
}

export const listVpnNodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VpnNodeView[]> => {
    await assertCapability(context, "canManageSystem");
    const db = await admin();
    const { data, error } = await db
      .from("vpn_exit_nodes")
      .select(
        "id, name, country, country_code, relay_url, priority, enabled, status, latency_ms, last_checked_at, last_error, created_at",
      )
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as VpnNodeView[];
  });

export const addVpnNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      name: string;
      relayUrl: string;
      relayToken: string;
      country?: string;
      countryCode?: string;
      priority?: number;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageSystem");
    const name = data.name.trim();
    const relayUrl = data.relayUrl.trim().replace(/\/+$/, "");
    if (!name) throw new Error("أدخل اسم الخادم");
    if (!/^https?:\/\//i.test(relayUrl)) throw new Error("رابط المُرحِّل يجب أن يبدأ بـ http(s)://");
    if (!data.relayToken.trim()) throw new Error("أدخل رمز المصادقة");

    const { writeAudit } = await import("./audit.server");
    const { invalidateExitNodeCache, probeExitNode } = await import("./vpn.server");
    const db = await admin();

    const probe = await probeExitNode({ id: "new", relay_url: relayUrl, relay_token: data.relayToken.trim() });

    const { data: saved, error } = await db
      .from("vpn_exit_nodes")
      .insert({
        name,
        relay_url: relayUrl,
        relay_token: data.relayToken.trim(),
        country: data.country?.trim() || null,
        country_code: data.countryCode?.trim().toUpperCase() || null,
        priority: Number.isFinite(Number(data.priority)) ? Number(data.priority) : 100,
        status: probe.ok ? "up" : "down",
        latency_ms: probe.latencyMs,
        last_checked_at: new Date().toISOString(),
        last_error: probe.ok ? null : (probe.error ?? "unreachable"),
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    invalidateExitNodeCache();
    await writeAudit({
      actorId: context.userId,
      action: "vpn.add_exit_node",
      meta: { name, relayUrl, reachable: probe.ok },
    });
    return { ok: true, id: (saved as { id: string }).id, reachable: probe.ok, ip: probe.ip ?? null, error: probe.error ?? null };
  });

export const testVpnNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageSystem");
    const { probeExitNode, invalidateExitNodeCache } = await import("./vpn.server");
    const db = await admin();

    const { data: row, error } = await db
      .from("vpn_exit_nodes")
      .select("id, relay_url, relay_token")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("الخادم غير موجود");

    const probe = await probeExitNode(row as { id: string; relay_url: string; relay_token: string });
    await db
      .from("vpn_exit_nodes")
      .update({
        status: probe.ok ? "up" : "down",
        latency_ms: probe.latencyMs,
        last_checked_at: new Date().toISOString(),
        last_error: probe.ok ? null : (probe.error ?? "unreachable"),
      } as never)
      .eq("id", data.id);
    await db.from("vpn_route_events").insert({
      node_id: data.id,
      event_type: probe.ok ? "probe_ok" : "probe_failed",
      message: probe.ok ? (probe.ip ?? null) : (probe.error ?? null),
      latency_ms: probe.latencyMs,
    } as never);
    invalidateExitNodeCache();
    return { ok: probe.ok, latencyMs: probe.latencyMs, ip: probe.ip ?? null, error: probe.error ?? null };
  });

export const updateVpnNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; enabled?: boolean; priority?: number }) => d)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageSystem");
    const { invalidateExitNodeCache } = await import("./vpn.server");
    const db = await admin();
    const patch: Record<string, unknown> = {};
    if (typeof data.enabled === "boolean") patch["enabled"] = data.enabled;
    if (Number.isFinite(Number(data.priority))) patch["priority"] = Number(data.priority);
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await db.from("vpn_exit_nodes").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    invalidateExitNodeCache();
    return { ok: true };
  });

export const deleteVpnNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageSystem");
    const { writeAudit } = await import("./audit.server");
    const { invalidateExitNodeCache } = await import("./vpn.server");
    const db = await admin();
    const { error } = await db.from("vpn_exit_nodes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    invalidateExitNodeCache();
    await writeAudit({ actorId: context.userId, action: "vpn.delete_exit_node", meta: { id: data.id } });
    return { ok: true };
  });

export const listVpnEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCapability(context, "canManageSystem");
    const db = await admin();
    const { data } = await db
      .from("vpn_route_events")
      .select("id, node_id, event_type, message, latency_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    return (data ?? []) as Array<{
      id: string;
      node_id: string | null;
      event_type: string;
      message: string | null;
      latency_ms: number | null;
      created_at: string;
    }>;
  });

/** Regions offered to viewers in the app settings (enabled + healthy only). */
export const availableVpnRegions = createServerFn({ method: "GET" }).handler(async () => {
  const { loadExitNodes } = await import("./vpn.server");
  const nodes = await loadExitNodes();
  const seen = new Set<string>();
  const regions: Array<{ code: string; label: string }> = [];
  for (const n of nodes) {
    const code = (n.country_code ?? "").toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    regions.push({ code, label: n.country || code });
  }
  return { enabled: nodes.length > 0, regions };
});
