/**
 * Trace Search — resolve any billing entity to its correlation ID(s).
 * Given an invoice, subscription, payment intent, order, webhook event,
 * or organization, return the correlation IDs whose traces cover it.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const KIND = z.enum(["correlation", "invoice", "subscription", "payment", "order", "webhook", "organization"]);
type Kind = z.infer<typeof KIND>;

export interface TraceHit {
  correlationId: string;
  firstSeen: string;
  lastSeen: string;
  refType: string;
  refId: string;
  eventCount: number;
}

async function assertAdmin(context: { supabase: { rpc: (n: string, a: unknown) => Promise<{ data: unknown }> }; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const searchTraces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: KIND, value: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<{ hits: TraceHit[] }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const v = data.value.trim();

    const agg = new Map<string, TraceHit>();
    const addRow = (cid: string | null | undefined, at: string, refType: string, refId: string) => {
      if (!cid) return;
      const cur = agg.get(cid);
      if (!cur) agg.set(cid, { correlationId: cid, firstSeen: at, lastSeen: at, refType, refId, eventCount: 1 });
      else {
        cur.eventCount++;
        if (at < cur.firstSeen) cur.firstSeen = at;
        if (at > cur.lastSeen) cur.lastSeen = at;
      }
    };

    const collect = async (rows: Array<Record<string, unknown>>, refType: string, refIdCol: string, atCol = "created_at") => {
      for (const r of rows) addRow(r.correlation_id as string, String(r[atCol]), refType, String(r[refIdCol]));
    };

    switch (data.kind as Kind) {
      case "correlation": {
        // Verify existence in billing_events
        const { data: rows } = await supabaseAdmin.from("billing_events").select("correlation_id, created_at, ref_type, ref_id").eq("correlation_id", v).limit(500);
        await collect((rows ?? []) as never, "billing_event", "ref_id");
        break;
      }
      case "invoice": {
        const [a, b, c] = await Promise.all([
          supabaseAdmin.from("billing_events").select("correlation_id, created_at, ref_id").eq("ref_type", "invoice").eq("ref_id", v).limit(500),
          supabaseAdmin.from("payment_intents").select("correlation_id, created_at, invoice_id").eq("invoice_id", v).limit(500),
          supabaseAdmin.from("billing_idempotency").select("correlation_id, created_at, op_key").eq("op_type", "invoice.issue").eq("op_key", v).limit(500),
        ]);
        await collect((a.data ?? []) as never, "invoice", "ref_id");
        await collect((b.data ?? []) as never, "invoice", "invoice_id");
        await collect((c.data ?? []) as never, "invoice", "op_key");
        break;
      }
      case "subscription": {
        const [a, b] = await Promise.all([
          supabaseAdmin.from("subscription_events").select("correlation_id, created_at, subscription_id").eq("subscription_id", v).limit(500),
          supabaseAdmin.from("payment_intents").select("correlation_id, created_at, subscription_id").eq("subscription_id", v).limit(500),
        ]);
        await collect((a.data ?? []) as never, "subscription", "subscription_id");
        await collect((b.data ?? []) as never, "subscription", "subscription_id");
        break;
      }
      case "payment": {
        const { data: rows } = await supabaseAdmin.from("payment_intents").select("correlation_id, created_at, id").eq("id", v).limit(500);
        await collect((rows ?? []) as never, "payment", "id");
        break;
      }
      case "order": {
        const { data: rows } = await supabaseAdmin.from("billing_events").select("correlation_id, created_at, ref_id").eq("ref_type", "order").eq("ref_id", v).limit(500);
        await collect((rows ?? []) as never, "order", "ref_id");
        break;
      }
      case "webhook": {
        const [a, b] = await Promise.all([
          supabaseAdmin.from("webhook_deliveries").select("correlation_id, created_at, event_id").or(`event_id.eq.${v},endpoint_id.eq.${v}`).limit(500),
          supabaseAdmin.from("gateway_webhook_events").select("correlation_id, received_at, provider_event_id").eq("provider_event_id", v).limit(500),
        ]);
        await collect((a.data ?? []) as never, "webhook", "event_id");
        for (const r of (b.data ?? [])) addRow(r.correlation_id as string, String(r.received_at), "gateway_webhook", String(r.provider_event_id));
        break;
      }
      case "organization": {
        const { data: rows } = await supabaseAdmin
          .from("billing_events")
          .select("correlation_id, created_at, ref_type, ref_id")
          .eq("org_id", v)
          .order("created_at", { ascending: false })
          .limit(200);
        await collect((rows ?? []) as never, "org", "ref_id");
        break;
      }
    }

    const hits = Array.from(agg.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)).slice(0, 100);
    return { hits };
  });
