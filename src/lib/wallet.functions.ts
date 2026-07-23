/**
 * Server-fn surface for wallet operations. Admin-only for adjustments;
 * balances are readable by any org member (via `assertTenantAccess`).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability } from "./rbac.server";
import { assertTenantAccess } from "./tenancy.server";
import { getBalances, postMovement } from "./wallet.server";
import { writeAudit } from "./audit.server";

export const walletBalances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertTenantAccess(context, data.orgId);
    return await getBalances(data.orgId);
  });

export const walletHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; limit?: number }) => data)
  .handler(async ({ data, context }) => {
    await assertTenantAccess(context, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("wallet_ledger")
      .select("*")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(Math.min(500, data.limit ?? 100));
    return { rows: rows ?? [] };
  });

export const walletAdjust = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    orgId: string;
    deltaCents: number;
    kind: "topup" | "refund" | "commission" | "adjustment";
    memo?: string;
  }) => data)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageBilling");
    await assertTenantAccess(context, data.orgId);
    const row = await postMovement({
      orgId: data.orgId,
      deltaCents: Math.round(data.deltaCents),
      kind: data.kind,
      memo: data.memo,
      actorId: context.userId,
    });
    await writeAudit({
      actorId: context.userId,
      action: `wallet.${data.kind}`,
      after: { orgId: data.orgId, deltaCents: data.deltaCents, memo: data.memo, ledgerId: row.id },
    });
    return { row };
  });
