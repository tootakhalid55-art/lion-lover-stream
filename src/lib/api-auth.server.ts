/**
 * REST API authentication. Verifies API keys (SHA-256 hashed at rest),
 * enforces scopes + IP allowlist + rate limits, updates last-used tracking,
 * and logs every request. Returns a fully-authenticated context including
 * a scoped supabaseAdmin client (RLS bypass — tenant isolation is enforced
 * in code via orgId).
 */
import type { ApiScope } from "./api-scopes";
import { rateLimit } from "./rate-limit.server";
import { correlationFromRequest } from "./correlation.server";

export interface ApiAuthContext {
  keyId: string;
  orgId: string;
  scopes: ApiScope[];
  correlationId: string;
  ip: string;
  ua: string;
  admin: any;
}

export interface ApiAuthError {
  status: number;
  code: string;
  message: string;
}

function clientIpOf(req: Request): string {
  const h = req.headers;
  const raw =
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return raw;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashSecret(raw: string): Promise<string> {
  return sha256Hex(raw);
}

/** Parses the `Authorization: Bearer <token>` header. Token format: `nvk_<prefix>_<secret>`. */
function parseBearer(req: Request): { prefix: string; secret: string; raw: string } | null {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(nvk_([A-Za-z0-9]{6,12})_([A-Za-z0-9]+))$/);
  if (!m) return null;
  return { raw: m[1], prefix: m[2], secret: m[3] };
}

export async function authenticateApi(
  request: Request,
  requiredScopes: ApiScope[],
): Promise<{ ok: true; ctx: ApiAuthContext } | { ok: false; error: ApiAuthError; correlationId: string }> {
  const correlationId = correlationFromRequest(request);
  const ip = clientIpOf(request);
  const ua = request.headers.get("user-agent") || "unknown";

  const parsed = parseBearer(request);
  if (!parsed) {
    return { ok: false, correlationId, error: { status: 401, code: "missing_credentials", message: "Bearer API key required" } };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: keyRow, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, org_id, hash, scopes, allowed_ips, status, revoked_at, expires_at")
    .eq("prefix", parsed.prefix)
    .maybeSingle();
  if (error || !keyRow) {
    return { ok: false, correlationId, error: { status: 401, code: "invalid_key", message: "API key not found" } };
  }
  if (keyRow.revoked_at || keyRow.status !== "active") {
    return { ok: false, correlationId, error: { status: 401, code: "revoked", message: "API key revoked" } };
  }
  if (keyRow.expires_at && new Date(keyRow.expires_at).getTime() < Date.now()) {
    return { ok: false, correlationId, error: { status: 401, code: "expired", message: "API key expired" } };
  }

  const providedHash = await hashSecret(parsed.secret);
  // Timing-safe compare
  if (providedHash.length !== (keyRow.hash as string).length) {
    return { ok: false, correlationId, error: { status: 401, code: "invalid_key", message: "Invalid API key" } };
  }
  let diff = 0;
  for (let i = 0; i < providedHash.length; i++) diff |= providedHash.charCodeAt(i) ^ (keyRow.hash as string).charCodeAt(i);
  if (diff !== 0) {
    return { ok: false, correlationId, error: { status: 401, code: "invalid_key", message: "Invalid API key" } };
  }

  const allowedIps = (keyRow.allowed_ips as string[]) ?? [];
  if (allowedIps.length > 0 && !allowedIps.includes(ip)) {
    return { ok: false, correlationId, error: { status: 403, code: "ip_not_allowed", message: "Source IP not permitted" } };
  }

  const scopes = ((keyRow.scopes as string[]) ?? []) as ApiScope[];
  const missing = requiredScopes.filter((s) => !scopes.includes(s));
  if (missing.length > 0) {
    return {
      ok: false,
      correlationId,
      error: { status: 403, code: "insufficient_scope", message: `Missing scope(s): ${missing.join(", ")}` },
    };
  }

  // Layered rate limits: per-key (60/s burst), per-org (300/s), per-ip (120/s)
  const perKey = rateLimit(`api:key:${keyRow.id}`, { capacity: 60, refillPerSec: 30 });
  const perOrg = rateLimit(`api:org:${keyRow.org_id}`, { capacity: 300, refillPerSec: 150 });
  const perIp = rateLimit(`api:ip:${ip}`, { capacity: 120, refillPerSec: 60 });
  const denied = [perKey, perOrg, perIp].find((r) => !r.allowed);
  if (denied) {
    return {
      ok: false,
      correlationId,
      error: { status: 429, code: "rate_limited", message: `Rate limit; retry in ${denied.retryAfterMs}ms` },
    };
  }

  // Fire-and-forget last-used update.
  supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString(), last_used_ip: ip })
    .eq("id", keyRow.id)
    .then(() => {}, () => {});

  return {
    ok: true,
    ctx: {
      keyId: keyRow.id,
      orgId: keyRow.org_id,
      scopes,
      correlationId,
      ip,
      ua,
      admin: supabaseAdmin,
    },
  };
}

export async function logApiRequest(
  ctx: Pick<ApiAuthContext, "keyId" | "orgId" | "ip" | "ua">,
  method: string,
  path: string,
  status: number,
  ms: number,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("api_request_log").insert({
      key_id: ctx.keyId,
      org_id: ctx.orgId,
      method,
      path,
      status,
      ms,
      ip: ctx.ip,
      user_agent: ctx.ua,
    });
  } catch (e) {
    console.error("[api-log] failed", e);
  }
}
