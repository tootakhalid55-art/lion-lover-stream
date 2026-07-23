import { createFileRoute } from "@tanstack/react-router";
import { makeV1Handler } from "@/lib/api-v1-handler.server";

const handler = makeV1Handler(
  {
    GET: {
      scopes: ["licenses:read"],
      fn: async ({ ctx, params }) => {
        const { data, error } = await ctx.admin
          .from("licenses")
          .select("*")
          .eq("id", params.id)
          .eq("org_id", ctx.orgId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new Error("License not found");
        return { data };
      },
    },
  },
  "/api/v1/licenses/:id",
);

export const Route = createFileRoute("/api/v1/licenses/$id")({
  server: { handlers: { GET: handler, OPTIONS: handler } },
});
