/**
 * KPIs for /admin/billing.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability } from "./rbac.server";
import { visibleOrgIds } from "./tenancy.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const billingDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCapability(context, "canViewFinance");
    const sb = await admin();
    const orgs = await visibleOrgIds(context);
    if (orgs.length === 0) {
      return { mrCents: 0, arCents: 0, outstandingCents: 0, overdueCount: 0, paidTodayCents: 0, byPackage: [], byReseller: [] };
    }
    const now = new Date();
    const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1).toISOString();
    const yearStart = new Date(now.getUTCFullYear(), 0, 1).toISOString();
    const dayStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()).toISOString();

    const paidBase = sb.from("invoices").select("total_cents, currency, org_id, meta").in("org_id", orgs).eq("status", "paid");
    const [{ data: mrRows }, { data: arRows }, { data: outRows }, { data: overdue }, { data: todayRows }] = await Promise.all([
      paidBase.gte("paid_at", monthStart),
      sb.from("invoices").select("total_cents").in("org_id", orgs).eq("status", "paid").gte("paid_at", yearStart),
      sb.from("invoices").select("amount_due_cents").in("org_id", orgs).in("status", ["issued", "sent", "partially_paid", "overdue"]),
      sb.from("invoices").select("id", { count: "exact", head: true }).in("org_id", orgs).eq("status", "overdue"),
      sb.from("invoices").select("total_cents").in("org_id", orgs).eq("status", "paid").gte("paid_at", dayStart),
    ]);

    const sum = (rows: any[] | null, col: string) => (rows ?? []).reduce((a: number, r: any) => a + Number(r[col] ?? 0), 0);
    return {
      mrCents: sum(mrRows, "total_cents"),
      arCents: sum(arRows, "total_cents"),
      outstandingCents: sum(outRows, "amount_due_cents"),
      overdueCount: (overdue as any)?.length ?? 0,
      paidTodayCents: sum(todayRows, "total_cents"),
      byPackage: [] as Array<{ label: string; cents: number }>,
      byReseller: [] as Array<{ label: string; cents: number }>,
    };
  });
