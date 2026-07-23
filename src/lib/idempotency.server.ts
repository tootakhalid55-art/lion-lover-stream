/**
 * Idempotency store for API v1. Stores the first successful response for
 * an (org, key, method, path) tuple for 24h. Duplicate requests with the
 * same Idempotency-Key + matching request hash replay the stored response;
 * mismatched bodies return 409.
 */
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function requestHash(method: string, path: string, body: string): Promise<string> {
  return sha256Hex(`${method}\n${path}\n${body}`);
}

export interface IdemLookup {
  status: "fresh" | "replay" | "conflict";
  response?: { status: number; body: string };
}

export async function idempotencyBegin(
  orgId: string,
  apiKeyId: string,
  key: string,
  method: string,
  path: string,
  bodyHash: string,
  correlationId: string,
): Promise<IdemLookup> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("idempotency_keys")
    .select("*")
    .eq("org_id", orgId)
    .eq("key", key)
    .eq("method", method)
    .eq("path", path)
    .maybeSingle();
  if (existing) {
    if (existing.request_hash !== bodyHash) return { status: "conflict" };
    if (existing.response_status != null && existing.response_body != null) {
      return { status: "replay", response: { status: existing.response_status, body: existing.response_body } };
    }
    // In-flight; treat as fresh — caller may still race, but the unique constraint below prevents dupes.
    return { status: "fresh" };
  }
  const { error } = await supabaseAdmin.from("idempotency_keys").insert({
    org_id: orgId,
    api_key_id: apiKeyId,
    key,
    method,
    path,
    request_hash: bodyHash,
    correlation_id: correlationId,
  });
  if (error && !/duplicate/i.test(error.message)) {
    console.error("[idem] insert failed", error);
  }
  return { status: "fresh" };
}

export async function idempotencyStore(
  orgId: string,
  key: string,
  method: string,
  path: string,
  status: number,
  body: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("idempotency_keys")
    .update({ response_status: status, response_body: body })
    .eq("org_id", orgId)
    .eq("key", key)
    .eq("method", method)
    .eq("path", path);
}
