/**
 * Readiness probe. Reports each subsystem's status; overall = ok only when
 * every critical subsystem is ok. Non-critical subsystems (webhooks queue,
 * background jobs) degrade to "degraded" instead of failing readiness.
 */
import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, optionsResponse } from "@/lib/api-response.server";
import { correlationFromRequest } from "@/lib/correlation.server";

type Check = { status: "ok" | "degraded" | "down"; latency_ms: number; detail?: string };

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; value?: T; ms: number; error?: string }> {
  const t = Date.now();
  try {
    const v = await fn();
    return { ok: true, value: v, ms: Date.now() - t };
  } catch (e: any) {
    return { ok: false, ms: Date.now() - t, error: e?.message || String(e) };
  }
}

async function handler({ request }: { request: Request }): Promise<Response> {
  const cid = correlationFromRequest(request);
  if (request.method === "OPTIONS") return optionsResponse(cid);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const dbCheck = await timed(async () => {
    const { error } = await supabaseAdmin.from("packages").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw new Error(error.message);
    return true;
  });

  const storageCheck = await timed(async () => {
    // Storage bucket listing — succeeds even with no buckets.
    const { error } = await (supabaseAdmin as any).storage.listBuckets();
    if (error) throw new Error(error.message);
    return true;
  });

  const webhookCheck = await timed(async () => {
    const { data, error } = await supabaseAdmin
      .from("webhook_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("dead", false);
    if (error) throw new Error(error.message);
    return data;
  });

  const billingCheck = await timed(async () => {
    const { error } = await supabaseAdmin.from("tax_rules").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw new Error(error.message);
    return true;
  });

  const jobsCheck: Check = {
    status: "ok",
    latency_ms: 0,
    detail: "in-process drain via /api/v1/webhooks/drain; no external queue",
  };

  const subsystems: Record<string, Check> = {
    database: { status: dbCheck.ok ? "ok" : "down", latency_ms: dbCheck.ms, detail: dbCheck.error },
    storage: { status: storageCheck.ok ? "ok" : "degraded", latency_ms: storageCheck.ms, detail: storageCheck.error },
    webhooks: { status: webhookCheck.ok ? "ok" : "degraded", latency_ms: webhookCheck.ms, detail: webhookCheck.error },
    billing: { status: billingCheck.ok ? "ok" : "down", latency_ms: billingCheck.ms, detail: billingCheck.error },
    jobs: jobsCheck,
  };

  const critical = ["database", "billing"];
  const anyDown = critical.some((k) => subsystems[k].status === "down");
  const overall = anyDown ? "down" : Object.values(subsystems).some((s) => s.status !== "ok") ? "degraded" : "ok";

  return jsonResponse(
    { data: { status: overall, subsystems, ts: new Date().toISOString() } },
    { status: overall === "down" ? 503 : 200, correlationId: cid },
  );
}

export const Route = createFileRoute("/api/v1/health/ready")({
  server: { handlers: { GET: handler, OPTIONS: handler } },
});
