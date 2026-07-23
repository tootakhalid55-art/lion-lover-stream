// Feature flag evaluation with platform / org / reseller scope precedence.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type FlagScope = "platform" | "org" | "reseller";

interface EvalContext {
  orgId?: string | null;
  resellerId?: string | null;
}

const cache = new Map<string, { value: boolean; expires: number }>();
const TTL_MS = 30_000;

export async function isFlagEnabled(key: string, ctx: EvalContext = {}): Promise<boolean> {
  const cacheKey = `${key}:${ctx.orgId ?? ""}:${ctx.resellerId ?? ""}`;
  const hit = cache.get(cacheKey);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.value;

  const [{ data: flag }, { data: overrides }] = await Promise.all([
    supabaseAdmin.from("feature_flags").select("default_enabled").eq("key", key).maybeSingle(),
    supabaseAdmin.from("feature_flag_overrides").select("scope, scope_id, enabled").eq("flag_key", key),
  ]);

  let value = flag?.default_enabled ?? false;
  if (overrides && overrides.length > 0) {
    // precedence: org > reseller > platform
    const byScope = (s: FlagScope, id?: string | null) =>
      overrides.find((o) => o.scope === s && (id ? o.scope_id === id : o.scope_id === null));
    const platform = byScope("platform", null);
    if (platform) value = platform.enabled;
    if (ctx.resellerId) {
      const r = byScope("reseller", ctx.resellerId);
      if (r) value = r.enabled;
    }
    if (ctx.orgId) {
      const o = byScope("org", ctx.orgId);
      if (o) value = o.enabled;
    }
  }
  cache.set(cacheKey, { value, expires: now + TTL_MS });
  return value;
}

export function clearFlagCache(): void {
  cache.clear();
}
