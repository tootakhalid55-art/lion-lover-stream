import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listInvoices } from "@/lib/billing.functions";
import { RouteError } from "@/components/RouteError";
import { FileText, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "My Billing — Nova TV" },
      { name: "description", content: "View invoices, payment history, and outstanding balance." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PortalPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/_authenticated/portal.tsx" functionName="PortalPage" lineNumber={15} />
  ),
});

const money = (c: number, cur = "USD") => new Intl.NumberFormat("en", { style: "currency", currency: cur }).format((c ?? 0) / 100);

function PortalPage() {
  const invFn = useServerFn(listInvoices);
  const q = useQuery({ queryKey: ["portal", "invoices"], queryFn: () => invFn({ data: { limit: 50 } }), staleTime: 15_000 });
  const rows: any[] = q.data?.rows ?? [];
  const outstanding = rows.reduce((a, r) => a + (r.amount_due_cents ?? 0), 0);

  return (
    <div dir="ltr" className="mx-auto max-w-4xl px-4 py-8 space-y-6 text-foreground">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-primary/80">Nova TV Portal</p>
          <h1 className="text-2xl font-black">My billing</h1>
        </div>
        <Link to="/" className="text-xs text-foreground/60 hover:text-foreground">Back to app</Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-amber-400"><Wallet className="h-4 w-4" /> Outstanding balance</div>
          <div className="mt-2 text-2xl font-black tabular-nums">{money(outstanding)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-primary"><FileText className="h-4 w-4" /> Invoices</div>
          <div className="mt-2 text-2xl font-black tabular-nums">{rows.length}</div>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5">
        <header className="border-b border-white/10 px-4 py-3 text-sm font-bold">Invoice history</header>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-foreground/60">
              <tr>
                <th className="px-4 py-2 text-left">Number</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Due</th>
                <th className="px-4 py-2 text-left">Issued</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-t border-white/5">
                  <td className="px-4 py-2 font-mono text-xs">{i.number}</td>
                  <td className="px-4 py-2 text-xs">{i.status}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(i.total_cents, i.currency)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(i.amount_due_cents, i.currency)}</td>
                  <td className="px-4 py-2 text-xs text-foreground/60">{i.issued_at?.slice(0, 10) ?? "-"}</td>
                  <td className="px-4 py-2 text-right">
                    <a href={`/api/billing/invoices/${i.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Download</a>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !q.isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-foreground/50">No invoices yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-foreground/40">Online payment coming soon. Contact your reseller to settle outstanding balances.</p>
    </div>
  );
}
