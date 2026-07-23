/**
 * Admin-facing server functions for API key + webhook endpoint management.
 * Backing storage stores only SHA-256 of the secret; the plaintext token is
 * returned exactly once on creation.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability } from "./rbac.server";
import { assertTenantAccess } from "./tenancy.server";
import { API_SCOPES, isValidScope, type ApiScope } from "./api-scopes";
import { hashSecret } from "./api-auth.server";
import { WEBHOOK_EVENTS, replayDelivery, drainPending } from "./webhooks.server";
import { writeAudit } from "./audit.server";
import { correlationFromRequest } from "./correlation.server";

function randToken(len: number): string {
  const alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < len; i++) s += alpha[bytes[i] % alpha.length];
  return s;
}

export const listApiKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context as any, "canManageApiKeys");
    await assertTenantAccess(context as any, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("api_keys")
      .select("id, name, description, prefix, scopes, allowed_ips, status, expires_at, last_used_at, last_used_ip, revoked_at, created_at, created_by")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    return { keys: rows ?? [] };
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    orgId: string;
    name: string;
    description?: string;
    scopes: string[];
    allowedIps?: string[];
    expiresAt?: string | null;
  }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context as any, "canManageApiKeys");
    await assertTenantAccess(context as any, data.orgId);
    if (!data.name.trim()) throw new Error("Name required");
    const scopes: ApiScope[] = data.scopes.filter(isValidScope) as ApiScope[];
    if (scopes.length === 0) throw new Error("At least one valid scope required");
    const prefix = randToken(8);
    const secret = randToken(40);
    const hash = await hashSecret(secret);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        org_id: data.orgId,
        name: data.name.trim(),
        description: data.description ?? null,
        prefix,
        hash,
        scopes,
        allowed_ips: data.allowedIps ?? [],
        expires_at: data.expiresAt ?? null,
        created_by: (context as any).userId,
        status: "active",
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message || "Create failed");
    await writeAudit({
      actorId: (context as any).userId,
      action: "api_key.create",
      meta: { keyId: row.id, orgId: data.orgId, scopes, name: data.name },
    });
    return { id: row.id, token: `nvk_${prefix}_${secret}`, prefix };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { keyId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context as any, "canManageApiKeys");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("api_keys").select("org_id").eq("id", data.keyId).maybeSingle();
    if (!existing) throw new Error("Key not found");
    await assertTenantAccess(context as any, existing.org_id as string);
    await supabaseAdmin
      .from("api_keys")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.keyId);
    await writeAudit({ actorId: (context as any).userId, action: "api_key.revoke", meta: { keyId: data.keyId } });
    return { ok: true };
  });

export const listWebhookEndpoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context as any, "canManageWebhooks");
    await assertTenantAccess(context as any, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("webhook_endpoints")
      .select("id, url, description, events, active, created_at, updated_at")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    return { endpoints: rows ?? [] };
  });

export const createWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; url: string; description?: string; events: string[] }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context as any, "canManageWebhooks");
    await assertTenantAccess(context as any, data.orgId);
    try {
      const u = new URL(data.url);
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch {
      throw new Error("Invalid URL");
    }
    const validEvents = data.events.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
    if (validEvents.length === 0) throw new Error("At least one valid event required");
    const secret = randToken(48);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("webhook_endpoints")
      .insert({
        org_id: data.orgId,
        url: data.url,
        description: data.description ?? null,
        events: validEvents,
        secret,
        active: true,
        created_by: (context as any).userId,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message || "Create failed");
    await writeAudit({
      actorId: (context as any).userId,
      action: "webhook.endpoint.create",
      meta: { endpointId: row.id, orgId: data.orgId, url: data.url, events: validEvents },
    });
    return { id: row.id, secret };
  });

export const toggleWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { endpointId: string; active: boolean }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context as any, "canManageWebhooks");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ep } = await supabaseAdmin.from("webhook_endpoints").select("org_id").eq("id", data.endpointId).maybeSingle();
    if (!ep) throw new Error("Endpoint not found");
    await assertTenantAccess(context as any, ep.org_id as string);
    await supabaseAdmin.from("webhook_endpoints").update({ active: data.active }).eq("id", data.endpointId);
    await writeAudit({
      actorId: (context as any).userId,
      action: data.active ? "webhook.endpoint.enable" : "webhook.endpoint.disable",
      meta: { endpointId: data.endpointId },
    });
    return { ok: true };
  });

export const listWebhookDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    orgId: string;
    endpointId?: string | null;
    event?: string | null;
    status?: string | null;
    limit?: number;
  }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context as any, "canManageWebhooks");
    await assertTenantAccess(context as any, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: eps } = await supabaseAdmin.from("webhook_endpoints").select("id").eq("org_id", data.orgId);
    const epIds = (eps ?? []).map((e: any) => e.id);
    if (epIds.length === 0) return { deliveries: [] };
    let q = supabaseAdmin
      .from("webhook_deliveries")
      .select("id, endpoint_id, event_id, status, attempt, response_status, next_attempt_at, delivered_at, created_at, correlation_id, dead, last_error, webhook_events(kind, payload)")
      .in("endpoint_id", epIds)
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 500));
    if (data.endpointId) q = q.eq("endpoint_id", data.endpointId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows } = await q;
    const filtered = data.event
      ? (rows ?? []).filter((r: any) => r.webhook_events?.kind === data.event)
      : rows ?? [];
    return { deliveries: filtered };
  });

export const replayWebhookDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { deliveryId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context as any, "canManageWebhooks");
    const correlationId = correlationFromRequest();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: d } = await supabaseAdmin
      .from("webhook_deliveries")
      .select("endpoint_id, webhook_endpoints(org_id)")
      .eq("id", data.deliveryId)
      .maybeSingle();
    const orgId = (d as any)?.webhook_endpoints?.org_id;
    if (!orgId) throw new Error("Delivery not found");
    await assertTenantAccess(context as any, orgId);
    await replayDelivery(data.deliveryId, correlationId);
    await writeAudit({
      actorId: (context as any).userId,
      action: "webhook.delivery.replay",
      meta: { deliveryId: data.deliveryId, correlationId },
    });
    return { ok: true, correlationId };
  });

export const drainWebhookQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCapability(context as any, "canManageWebhooks");
    const result = await drainPending(50);
    return result;
  });

export const listApiScopes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ scopes: API_SCOPES, events: WEBHOOK_EVENTS }));

export const apiUsageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; hours?: number }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context as any, "canManageApiKeys");
    await assertTenantAccess(context as any, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - (data.hours ?? 24) * 3600_000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("api_request_log")
      .select("status, ms, method, path, at")
      .eq("org_id", data.orgId)
      .gte("at", since)
      .order("at", { ascending: false })
      .limit(2000);
    const list = rows ?? [];
    const total = list.length;
    const errors = list.filter((r: any) => r.status >= 500).length;
    const rateLimited = list.filter((r: any) => r.status === 429).length;
    const authFail = list.filter((r: any) => r.status === 401 || r.status === 403).length;
    const avgMs = total ? Math.round(list.reduce((a, b: any) => a + (b.ms || 0), 0) / total) : 0;
    return { total, errors, rateLimited, authFail, avgMs, recent: list.slice(0, 100) };
  });
