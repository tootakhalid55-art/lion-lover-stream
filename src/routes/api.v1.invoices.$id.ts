import { createFileRoute } from "@tanstack/react-router";
import { makeV1Handler } from "@/lib/api-v1-handler.server";

const handler = makeV1Handler(
  {
    GET: {
      scopes: ["invoices:read"],
      fn: async ({ ctx, params }) => {
        const { data, error } = await ctx.admin
          .from("invoices")
          .select("*, invoice_lines(*)")
          .eq("org_id", ctx.orgId)
          .eq("id", params.id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new Error("Invoice not found");
        return { data };
      },
    },
  },
  "/api/v1/invoices/:id",
);

export const Route = createFileRoute("/api/v1/invoices/$id")({
  server: { handlers: { GET: handler, OPTIONS: handler } },
});
