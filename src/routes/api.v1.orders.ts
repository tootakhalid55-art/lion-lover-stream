import { createFileRoute } from "@tanstack/react-router";
import { makeV1Handler, parseListParams } from "@/lib/api-v1-handler.server";
import { emitWebhook } from "@/lib/webhooks.server";

const handler = makeV1Handler(
  {
    GET: {
      scopes: ["orders:read"],
      fn: async ({ ctx, request }) => {
        const url = new URL(request.url);
        const { limit, cursor, from, to } = parseListParams(url);
        let query = ctx.admin
          .from("license_orders")
          .select("id, package_id, qty, unit_price_cents, currency, total_cents, status, invoice_id, created_at, paid_at, fulfilled_at")
          .eq("org_id", ctx.orgId)
          .order("created_at", { ascending: false })
          .limit(limit + 1);
        if (cursor) query = query.lt("created_at", cursor);
        if (from) query = query.gte("created_at", from);
        if (to) query = query.lte("created_at", to);
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        const rows = data ?? [];
        const hasMore = rows.length > limit;
        const trimmed = hasMore ? rows.slice(0, limit) : rows;
        return {
          data: trimmed,
          meta: {
            correlation_id: ctx.correlationId,
            api_version: "1.0.0",
            page: { next_cursor: hasMore ? trimmed[trimmed.length - 1]?.created_at : null },
          },
        };
      },
    },
    POST: {
      scopes: ["orders:write"],
      fn: async ({ ctx, body }) => {
        if (!body || typeof body !== "object") throw new Error("Invalid body");
        const packageId = String(body.package_id ?? "");
        const qty = Math.max(1, Number(body.qty ?? 1));
        if (!packageId) throw new Error("package_id required");
        const { resolvePrice } = await import("@/lib/pricing.server");
        const quote = await resolvePrice({ packageId, orgId: ctx.orgId, qty, promoCode: body.promo_code ?? null });
        const { data: order, error } = await ctx.admin
          .from("license_orders")
          .insert({
            org_id: ctx.orgId,
            package_id: packageId,
            qty,
            unit_price_cents: quote.unitPriceCents,
            currency: quote.currency,
            discount_cents: quote.discountCents,
            tax_cents: quote.taxCents,
            total_cents: quote.totalCents,
            status: "draft",
            pricing_trace: quote.trace as any,
          })
          .select("*")
          .single();
        if (error || !order) throw new Error(error?.message || "Order create failed");
        await emitWebhook(ctx.orgId, "order.created", { order }, ctx.correlationId);
        return { data: order, status: 201 };
      },
    },
  },
  "/api/v1/orders",
);

export const Route = createFileRoute("/api/v1/orders")({
  server: { handlers: { GET: handler, POST: handler, OPTIONS: handler } },
});
