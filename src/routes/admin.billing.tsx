import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { billingDashboard } from "@/lib/billing-dashboard.functions";
import { listInvoices, listBillingEvents } from "@/lib/billing.functions";
import { RouteError } from "@/components/RouteError";
import { AdminHeader, Pill } from "@/components/admin/ui";
import { Banknote, FileText, AlertTriangle, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/admin/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Nova TV" },
      { name: "description", content: "Invoices, revenue, payments, and billing events." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: BillingPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.billing.tsx" functionName="BillingPage" lineNumber={20} />
  ),
});

const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format((cents ?? 0) / 100);

function BillingPage() {
  const dashFn = useServerFn(billingDashboard);
  const invFn = useServerFn(listInvoices);
  const evFn = useServerFn(listBillingEvents);
  const dash = useQuery({ queryKey: ["billing", "dash"], queryFn: () => dashFn(), staleTime: 30_000 });
  const invs = useQuery({ queryKey: ["billing", "invoices"], queryFn: () => invFn({ data: { limit: 50 } }), staleTime: 15_000 });
  const events = useQuery({ queryKey: ["billing", "events"], queryFn: () => evFn({ data: { limit: 30 } }), staleTime: 15_000 });

  return (
    <div dir="ltr" className="space-y-6">
      <AdminHeader title="Billing" subtitle="Invoices, revenue, and financial events across all tenants." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Revenue MTD" value={money(dash.data?.mrCents ?? 0)} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Revenue YTD" value={money(dash.data?.arCents ?? 0)} />
        <Kpi icon={<Banknote className="h-4 w-4" />} label="Outstanding" value={money(dash.data?.outstandingCents ?? 0)} accent="warn" />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Overdue" value={String(dash.data?.overdueCount ?? 0)} accent="danger" />
        <Kpi icon={<Banknote className="h-4 w-4" />} label="Paid Today" value={money(dash.data?.paidTodayCents ?? 0)} />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-bold flex items-center gap-2"><FileText className="h-4 w-4" /> Recent invoices</h2>
        </header>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-foreground/60">
              <tr>
                <th className="px-4 py-2 text-left">Number</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Due</th>
                <th className="px-4 py-2 text-left">Issued</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {(invs.data?.rows ?? []).map((i: any) => (
                <tr key={i.id} className="border-t border-white/5">
                  <td className="px-4 py-2 font-mono text-xs">{i.number}</td>
                  <td className="px-4 py-2 text-xs">{i.doc_type}</td>
                  <td className="px-4 py-2"><Pill tone={pillTone(i.status)}>{i.status}</Pill></td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(i.total_cents, i.currency)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(i.amount_due_cents, i.currency)}</td>
                  <td className="px-4 py-2 text-xs text-foreground/60">{i.issued_at?.slice(0, 10) ?? "-"}</td>
                  <td className="px-4 py-2 text-right">
                    <a href={`/api/billing/invoices/${i.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs text-primary underline">PDF</a>
                  </td>
                </tr>
              ))}
              {!invs.isLoading && (invs.data?.rows ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-foreground/50 text-sm">No invoices yet. They appear automatically when orders are paid.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-bold">Billing events</h2>
          <span className="text-xs text-foreground/50">Downstream consumers subscribe here.</span>
        </header>
        <ul className="divide-y divide-white/5">
          {(events.data?.rows ?? []).map((e: any) => (
            <li key={e.id} className="flex items-center justify-between px-4 py-2 text-xs">
              <span className="font-mono">{e.event_type}</span>
              <span className="text-foreground/50">{new Date(e.created_at).toLocaleString()}</span>
            </li>
          ))}
          {(events.data?.rows ?? []).length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-foreground/50">No billing events recorded.</li>
          )}
        </ul>
      </section>

      <p className="text-xs text-foreground/40">
        Every mutation on this page routes through the billing engine (numbering, tax, snapshot, journal, events). Nothing writes invoices directly.
      </p>
    </div>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: "warn" | "danger" }) {
  const tone = accent === "danger" ? "text-red-400" : accent === "warn" ? "text-amber-400" : "text-primary";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className={`flex items-center gap-2 text-[11px] uppercase tracking-wider ${tone}`}>{icon}{label}</div>
      <div className="mt-2 text-xl font-black tabular-nums">{value}</div>
    </div>
  );
}

function pillTone(status: string): "success" | "warn" | "danger" | "muted" | "info" {
  if (status === "paid") return "success";
  if (status === "overdue") return "danger";
  if (status === "partially_paid" || status === "sent") return "warn";
  if (status === "cancelled" || status === "refunded" || status === "written_off") return "muted";
  return "info";
}
