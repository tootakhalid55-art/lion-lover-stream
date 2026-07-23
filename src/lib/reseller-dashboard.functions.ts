/**
 * Reseller KPIs — revenue, profit, wallet, customers, licenses, renewals.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertTenantAccess, visibleOrgIds } from "./tenancy.server";
import { getBalances } from "./wallet.server";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const resellerKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertTenantAccess(context, data.orgId);
    const admin = await getAdmin();
    // Descendant orgs for aggregate stats
    const descendants = await visibleOrgIds(context);
    const scoped = descendants.length ? descendants : [data.orgId];

    const now = Date.now();
    const in7 = new Date(now + 7 * 86400_000).toISOString();
    const in30 = new Date(now + 30 * 86400_000).toISOString();
    const past30 = new Date(now - 30 * 86400_000).toISOString();
    const iso = new Date().toISOString();

    const [balances, revenueRows, customersCount, activeLic, renewals30, expiring7, outstanding] = await Promise.all([
      getBalances(data.orgId),
      admin.from("license_orders").select("total_cents, discount_cents, currency, paid_at").in("org_id", scoped).eq("status", "paid").gt("paid_at", past30),
      admin.from("organizations").select("*", { count: "exact", head: true }).eq("type", "customer").in("id", scoped),
      admin.from("licenses").select("*", { count: "exact", head: true }).eq("status", "active"),
      admin.from("licenses").select("*", { count: "exact", head: true }).gt("activated_at", past30),
      admin.from("licenses").select("*", { count: "exact", head: true }).lt("expires_at", in7).gt("expires_at", iso),
      admin.from("license_orders").select("*", { count: "exact", head: true }).in("org_id", scoped).in("status", ["draft", "submitted"]),
    ]);

    const revenue = (revenueRows.data ?? []).reduce((s: number, r: any) => s + Number(r.total_cents ?? 0), 0);
    const grossDiscount = (revenueRows.data ?? []).reduce((s: number, r: any) => s + Number(r.discount_cents ?? 0), 0);
    // Naive profit = margin captured (order total − cost basis proxy). Refined in Step 5.
    const profit = Math.round(revenue * 0.25);

    return {
      wallet: balances,
      revenue30dCents: revenue,
      profit30dCents: profit,
      grossDiscountCents: grossDiscount,
      activeCustomers: customersCount.count ?? 0,
      activeLicenses: activeLic.count ?? 0,
      renewals30d: renewals30.count ?? 0,
      expiring7d: expiring7.count ?? 0,
      outstandingOrders: outstanding.count ?? 0,
      window: { from: past30, to: iso, expiring7dUntil: in7, in30d: in30 },
    };
  });
