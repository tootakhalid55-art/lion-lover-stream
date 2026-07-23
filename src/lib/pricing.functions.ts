/**
 * Server-fn surface for the pricing engine. Read-only preview endpoint used
 * by admin/reseller UIs and, later, by the REST API.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertTenantAccess } from "./tenancy.server";
import { resolvePrice } from "./pricing.server";

export const previewPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    packageId: string;
    orgId?: string | null;
    qty?: number;
    country?: string | null;
    promoCode?: string | null;
  }) => data)
  .handler(async ({ data, context }) => {
    if (data.orgId) await assertTenantAccess(context, data.orgId);
    const quote = await resolvePrice(data);
    return { quote };
  });
