import { createFileRoute } from "@tanstack/react-router";
import { makeV1Handler, parseListParams } from "@/lib/api-v1-handler.server";

const handler = makeV1Handler(
  {
    GET: {
      scopes: ["licenses:read"],
      fn: async ({ ctx, request }) => {
        const url = new URL(request.url);
        const { limit, cursor, q, from, to } = parseListParams(url);
        let query = ctx.admin
          .from("licenses")
          .select("id, user_id, package_id, license_key, license_type, status, activated_at, expires_at, created_at, org_id")
          .eq("org_id", ctx.orgId)
          .order("created_at", { ascending: false })
          .limit(limit + 1);
        if (cursor) query = query.lt("created_at", cursor);
        if (from) query = query.gte("created_at", from);
        if (to) query = query.lte("created_at", to);
        if (q) query = query.ilike("license_key", `%${q}%`);
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
  },
  "/api/v1/licenses",
);

export const Route = createFileRoute("/api/v1/licenses")({
  server: { handlers: { GET: handler, OPTIONS: handler } },
});
