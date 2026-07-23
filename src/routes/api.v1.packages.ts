import { createFileRoute } from "@tanstack/react-router";
import { makeV1Handler, parseListParams } from "@/lib/api-v1-handler.server";

const handler = makeV1Handler(
  {
    GET: {
      scopes: ["packages:read"],
      fn: async ({ ctx, request }) => {
        const url = new URL(request.url);
        const { limit, cursor, q } = parseListParams(url);
        let query = ctx.admin
          .from("packages")
          .select("id, name, tier, duration_days, max_devices, max_sessions, price_cents, currency, is_active, sort_order, created_at")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .limit(limit + 1);
        if (cursor) query = query.gt("sort_order", Number(cursor));
        if (q) query = query.ilike("name", `%${q}%`);
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
            page: { next_cursor: hasMore ? String(trimmed[trimmed.length - 1]?.sort_order) : null },
          },
        };
      },
    },
  },
  "/api/v1/packages",
);

export const Route = createFileRoute("/api/v1/packages")({
  server: { handlers: { GET: handler, OPTIONS: handler } },
});
