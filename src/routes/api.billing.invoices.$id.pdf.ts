/**
 * GET /api/billing/invoices/:id/pdf — renders the print-ready HTML for
 * an invoice. Auth is enforced by rebuilding an authenticated Supabase
 * client from the bearer token (session cookie or header) and reading
 * through RLS. Only members of the owning org (or ancestors) can view.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { renderInvoiceHtml, type InvoiceRenderModel } from "@/lib/billing-pdf.server";

export const Route = createFileRoute("/api/billing/invoices/$id/pdf")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = process.env.SUPABASE_URL!;
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "").trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        const sb = createClient(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: inv, error } = await sb.from("invoices").select("*").eq("id", params.id).maybeSingle();
        if (error || !inv) return new Response("Not found", { status: 404 });
        const { data: lines } = await sb.from("invoice_lines").select("*").eq("invoice_id", inv.id);

        const model: InvoiceRenderModel = {
          invoice: inv as any,
          lines: (lines ?? []) as any,
        };
        const html = renderInvoiceHtml(model);
        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `inline; filename="${inv.number}.html"`,
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
