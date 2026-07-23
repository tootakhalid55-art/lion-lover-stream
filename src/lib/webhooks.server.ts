/**
 * Webhook dispatcher. Enqueues events, delivers with HMAC signatures,
 * retries with exponential backoff, and dead-letters after max attempts.
 * Replay center in the admin UI reads/writes through the same primitives.
 */
export const WEBHOOK_EVENTS = [
  "user.created",
  "organization.created",
  "license.activated",
  "license.expired",
  "order.created",
  "order.fulfilled",
  "invoice.issued",
  "invoice.paid",
  "payment.received",
  "subscription.renewed",
  "webhook.failed",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const MAX_ATTEMPTS = 8;
// Exponential backoff in seconds: 30s, 1m, 5m, 15m, 1h, 6h, 24h, then dead.
const BACKOFF_SECONDS = [30, 60, 300, 900, 3600, 21600, 86400];

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Enqueue an event: writes a webhook_events row and pending delivery rows
 * for each active endpoint of `orgId` subscribed to `event`.
 */
export async function emitWebhook(
  orgId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
  correlationId?: string,
): Promise<{ eventId: string; enqueued: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: evtRow, error: evtErr } = await supabaseAdmin
    .from("webhook_events")
    .insert({ org_id: orgId, kind: event, payload: payload as any })
    .select("id")
    .single();
  if (evtErr || !evtRow) throw new Error(`webhook event insert failed: ${evtErr?.message}`);

  const { data: endpoints } = await supabaseAdmin
    .from("webhook_endpoints")
    .select("id, events, active")
    .eq("org_id", orgId)
    .eq("active", true);

  const targets = (endpoints ?? []).filter((e: any) => (e.events as string[]).includes(event));
  if (targets.length === 0) return { eventId: evtRow.id, enqueued: 0 };

  const rows = targets.map((e: any) => ({
    endpoint_id: e.id,
    event_id: evtRow.id,
    status: "pending",
    attempt: 0,
    next_attempt_at: new Date().toISOString(),
    correlation_id: correlationId ?? null,
  }));
  await supabaseAdmin.from("webhook_deliveries").insert(rows);
  return { eventId: evtRow.id, enqueued: rows.length };
}

/** Deliver a single delivery row, updating attempt/status/next_attempt. */
export async function deliverOnce(deliveryId: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: d } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("id, endpoint_id, event_id, attempt, correlation_id")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!d) return { ok: false, error: "delivery not found" };
  const { data: ep } = await supabaseAdmin
    .from("webhook_endpoints")
    .select("id, url, secret, active, org_id")
    .eq("id", d.endpoint_id)
    .maybeSingle();
  const { data: evt } = await supabaseAdmin
    .from("webhook_events")
    .select("kind, payload, created_at")
    .eq("id", d.event_id)
    .maybeSingle();
  if (!ep || !evt) return { ok: false, error: "endpoint/event missing" };
  if (!ep.active) return { ok: false, error: "endpoint disabled" };

  const attempt = (d.attempt ?? 0) + 1;
  const correlationId = d.correlation_id || `cid_${crypto.randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    id: d.event_id,
    event: evt.kind,
    created_at: evt.created_at,
    data: evt.payload,
  });
  const signature = await hmacSha256(ep.secret as string, `${timestamp}.${body}`);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-nova-event": String(evt.kind),
    "x-nova-delivery": d.id,
    "x-nova-signature": `t=${timestamp},v1=${signature}`,
    "x-nova-attempt": String(attempt),
    "x-correlation-id": correlationId,
    "user-agent": "NovaTV-Webhooks/1.0",
  };

  let respStatus = 0;
  let respBody = "";
  const respHeaders: Record<string, string> = {};
  let ok = false;
  let lastError: string | null = null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10_000);
    const res = await fetch(ep.url as string, { method: "POST", headers, body, signal: ctl.signal });
    clearTimeout(t);
    respStatus = res.status;
    respBody = (await res.text()).slice(0, 8000);
    res.headers.forEach((v, k) => (respHeaders[k] = v));
    ok = res.ok;
    if (!ok) lastError = `HTTP ${respStatus}`;
  } catch (e: any) {
    lastError = e?.message || "network error";
  }

  const shouldDead = !ok && attempt >= MAX_ATTEMPTS;
  const nextDelay = ok ? null : BACKOFF_SECONDS[Math.min(attempt - 1, BACKOFF_SECONDS.length - 1)];
  const nextAttemptAt = nextDelay != null && !shouldDead
    ? new Date(Date.now() + nextDelay * 1000).toISOString()
    : null;

  await supabaseAdmin
    .from("webhook_deliveries")
    .update({
      status: ok ? "delivered" : shouldDead ? "failed" : "pending",
      attempt,
      response_status: respStatus,
      response_body: respBody,
      response_headers: respHeaders as any,
      request_body: body,
      request_headers: headers as any,
      next_attempt_at: nextAttemptAt,
      delivered_at: ok ? new Date().toISOString() : null,
      dead: shouldDead,
      last_error: lastError,
    })
    .eq("id", deliveryId);

  if (shouldDead) {
    // Emit a follow-up webhook.failed event so ops tools can react.
    try {
      await emitWebhook(ep.org_id as string, "webhook.failed", {
        delivery_id: deliveryId,
        endpoint_id: ep.id,
        event: evt.kind,
        attempts: attempt,
        last_error: lastError,
      }, correlationId);
    } catch (e) {
      console.error("[webhook.failed] emit error", e);
    }
  }
  return { ok, status: respStatus, error: lastError ?? undefined };
}

/** Drain up to `limit` pending deliveries whose `next_attempt_at` has passed. */
export async function drainPending(limit = 20): Promise<{ processed: number; delivered: number; failed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: due } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("id")
    .eq("status", "pending")
    .eq("dead", false)
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  let delivered = 0, failed = 0;
  for (const row of due ?? []) {
    const r = await deliverOnce(row.id);
    if (r.ok) delivered++; else failed++;
  }
  return { processed: (due ?? []).length, delivered, failed };
}

/** Force-replay a delivery: resets to pending + next_attempt_at=now. */
export async function replayDelivery(deliveryId: string, correlationId?: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("webhook_deliveries")
    .update({
      status: "pending",
      dead: false,
      next_attempt_at: new Date().toISOString(),
      last_error: null,
      correlation_id: correlationId ?? null,
    })
    .eq("id", deliveryId);
  await deliverOnce(deliveryId);
}
