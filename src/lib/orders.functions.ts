/**
 * License order lifecycle:
 *
 *   draft → submitted → paid → fulfilled
 *              ↓
 *          cancelled
 *              ↓
 *          refunded
 *
 * On submit: a wallet reservation holds the order total against the
 * reseller's available balance.
 * On pay: the reservation is captured into a real ledger debit and the
 * order flips to `paid`. Fulfilment (license minting) is triggered next
 * turn — this module writes the order + pricing trace; the licensing
 * engine consumes `paid` orders to mint keys.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability } from "./rbac.server";
import { assertTenantAccess } from "./tenancy.server";
import { resolvePrice } from "./pricing.server";
import { reserve, capture, release } from "./wallet.server";
import { writeAudit } from "./audit.server";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadOrder(id: string) {
  const admin = await getAdmin();
  const { data, error } = await admin.from("license_orders").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Order not found");
  return data;
}

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    orgId: string;
    packageId: string;
    qty: number;
    promoCode?: string | null;
    country?: string | null;
  }) => data)
  .handler(async ({ data, context }) => {
    await assertTenantAccess(context, data.orgId);
    const admin = await getAdmin();
    const quote = await resolvePrice({
      packageId: data.packageId,
      orgId: data.orgId,
      qty: data.qty,
      promoCode: data.promoCode ?? null,
      country: data.country ?? null,
    });
    const { data: row, error } = await admin
      .from("license_orders")
      .insert({
        org_id: data.orgId,
        package_id: data.packageId,
        qty: data.qty,
        unit_price_cents: quote.unitPriceCents,
        currency: quote.currency,
        discount_cents: quote.discountCents,
        tax_cents: 0,
        total_cents: quote.totalCents,
        status: "draft",
        pricing_trace: quote.trace as any,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    await writeAudit({ actorId: context.userId, action: "order.create", after: row });
    return { order: row, quote };
  });

export const submitOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data, context }) => {
    const order = await loadOrder(data.orderId);
    await assertTenantAccess(context, order.org_id);
    if (order.status !== "draft") throw new Error(`Cannot submit order in status ${order.status}`);
    const admin = await getAdmin();
    const reservationId = await reserve({
      orgId: order.org_id,
      amountCents: order.total_cents,
      currency: order.currency,
      refType: "license_order",
      refId: order.id,
      memo: `Order ${order.id}`,
      actorId: context.userId,
    });
    const { data: updated } = await admin
      .from("license_orders")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        meta: { ...(order.meta as any), reservationId },
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .select("*")
      .single();
    await writeAudit({ actorId: context.userId, action: "order.submit", before: order, after: updated });
    return { order: updated };
  });

export const payOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageBilling");
    const order = await loadOrder(data.orderId);
    await assertTenantAccess(context, order.org_id);
    if (order.status !== "submitted") throw new Error(`Cannot pay order in status ${order.status}`);
    const reservationId = (order.meta as any)?.reservationId as string | undefined;
    if (!reservationId) throw new Error("Missing reservation");
    await capture({ reservationId, actorId: context.userId, memo: `Order ${order.id}` });
    const admin = await getAdmin();
    const { data: updated } = await admin
      .from("license_orders")
      .update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .select("*")
      .single();
    await writeAudit({ actorId: context.userId, action: "order.pay", before: order, after: updated });
    return { order: updated };
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    const order = await loadOrder(data.orderId);
    await assertTenantAccess(context, order.org_id);
    if (!["draft", "submitted"].includes(order.status)) throw new Error(`Cannot cancel order in status ${order.status}`);
    const reservationId = (order.meta as any)?.reservationId as string | undefined;
    if (reservationId) await release({ reservationId, actorId: context.userId });
    const admin = await getAdmin();
    const { data: updated } = await admin
      .from("license_orders")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        meta: { ...(order.meta as any), cancelReason: data.reason ?? null },
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .select("*")
      .single();
    await writeAudit({ actorId: context.userId, action: "order.cancel", before: order, after: updated });
    return { order: updated };
  });

export const listOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; status?: string; limit?: number }) => data)
  .handler(async ({ data, context }) => {
    await assertTenantAccess(context, data.orgId);
    const admin = await getAdmin();
    let q = admin.from("license_orders").select("*").eq("org_id", data.orgId).order("created_at", { ascending: false }).limit(Math.min(500, data.limit ?? 100));
    if (data.status) q = q.eq("status", data.status);
    const { data: rows } = await q;
    return { rows: rows ?? [] };
  });

export const getOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data, context }) => {
    const order = await loadOrder(data.orderId);
    await assertTenantAccess(context, order.org_id);
    return { order };
  });
