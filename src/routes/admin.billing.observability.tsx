import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, Gauge, RefreshCw, Send, ShieldAlert, Timer, TrendingUp } from "lucide-react";
import { getObservabilitySnapshot } from "@/lib/billing-observability.functions";
import { RouteError } from "@/components/RouteError";
import { AdminHeader, Pill } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/billing/observability")({
  head: () => ({ meta: [
    { title: "Billing Observability — Nova TV" },
    { name: "description", content: "Live billing KPIs: renewal success, payment health, retries, dunning, gateway latency." },
    { name: "robots", content: "noindex,nofollow" },
  ]}),
  component: ObservabilityPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.billing.observability.tsx" functionName="ObservabilityPage" lineNumber={20} />
  ),
});

function ObservabilityPage() {
  const fn = useServerFn(getObservabilitySnapshot);
  const [win, setWin] = useState<"24h" | "7d" | "30d">("24h");
  const q = useQuery({
    queryKey: ["observability", win],
    queryFn: () => fn({ data: { window: win } }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const s = q.data;

  return (
    <div dir="ltr" className="space-y-6">
      <AdminHeader title="Observability" subtitle="Live billing health — renewals, payments, retries, gateways, queues." />

      <div className="flex items-center gap-2">
        {(["24h", "7d", "30d"] as const).map((w) => (
          <button key={w} onClick={() => setWin(w)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold ring-1 ${win === w ? "bg-primary text-black ring-primary" : "bg-white/5 ring-white/10 hover:bg-white/10"}`}>
            {w}
          </button>
        ))}
        <button onClick={() => q.refetch()} className="ml-auto grid h-8 w-8 place-items-center rounded-lg bg-white/5 hover:bg-white/10" title="Refresh">
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Renewal Success" value={fmtPct(s?.renewalSuccessRate)} sub={`${fmtPct(s?.renewalFailureRate)} failure`} />
        <Kpi icon={<Gauge className="h-4 w-4" />} label="Payment Success" value={fmtPct(s?.paymentSuccessRate)} sub={`${fmtPct(s?.paymentFailureRate)} failure`} />
        <Kpi icon={<RefreshCw className="h-4 w-4" />} label="Retries" value={String(s?.retryCount ?? 0)} sub={`success ${fmtPct(s?.retrySuccessRate)}`} />
        <Kpi icon={<Activity className="h-4 w-4" />} label="Dunning Conversion" value={fmtPct(s?.dunningConversionRate)} sub="past_due → renewed" />
        <Kpi icon={<Timer className="h-4 w-4" />} label="Gateway P50" value={fmtMs(s?.gatewayLatencyP50)} />
        <Kpi icon={<Timer className="h-4 w-4" />} label="Gateway P95" value={fmtMs(s?.gatewayLatencyP95)} />
        <Kpi icon={<Timer className="h-4 w-4" />} label="Gateway P99" value={fmtMs(s?.gatewayLatencyP99)} accent="warn" />
        <Kpi icon={<Timer className="h-4 w-4" />} label="Avg Renewal" value={fmtMs(s?.avgRenewalDurationMs)} />
        <Kpi icon={<Send className="h-4 w-4" />} label="Webhook Success" value={fmtPct(s?.webhookSuccessRate)} sub={`${s?.webhookDelivered ?? 0} ok · ${s?.webhookFailed ?? 0} fail`} />
        <Kpi icon={<Send className="h-4 w-4" />} label="Outbox Pending" value={String(s?.outboxPending ?? 0)} sub={`${s?.outboxDead ?? 0} dead`} accent={((s?.outboxDead ?? 0) > 0) ? "warn" : undefined} />
        <Kpi icon={<ShieldAlert className="h-4 w-4" />} label="DLQ Size" value={String(s?.dlqSize ?? 0)} accent={((s?.dlqSize ?? 0) > 0) ? "danger" : undefined} />
        <Kpi icon={<ShieldAlert className="h-4 w-4" />} label="Breakers Open" value={String((s?.circuitBreakers ?? []).filter((b) => b.open).length)} accent={(s?.circuitBreakers ?? []).some((b) => b.open) ? "danger" : undefined} />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5">
        <header className="border-b border-white/10 px-4 py-3 text-sm font-bold">Circuit breakers</header>
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase text-foreground/60">
            <tr><th className="px-4 py-2 text-left">Provider</th><th className="px-4 py-2 text-left">Mode</th><th className="px-4 py-2 text-right">Failures ({win})</th><th className="px-4 py-2">State</th></tr>
          </thead>
          <tbody>
            {(s?.circuitBreakers ?? []).length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-foreground/50">All gateways healthy.</td></tr>}
            {(s?.circuitBreakers ?? []).map((b) => (
              <tr key={`${b.provider}:${b.mode}`} className="border-t border-white/5">
                <td className="px-4 py-2 font-mono text-xs">{b.provider}</td>
                <td className="px-4 py-2 text-xs">{b.mode}</td>
                <td className="px-4 py-2 text-right tabular-nums">{b.failuresInWindow}</td>
                <td className="px-4 py-2"><Pill tone={b.open ? "red" : "green"}>{b.open ? "OPEN" : "closed"}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5">
        <header className="border-b border-white/10 px-4 py-3 text-sm font-bold">Activity ({win})</header>
        <div className="p-4">
          <Sparkline series={s?.timeseries ?? []} />
        </div>
      </section>
    </div>
  );
}

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: "warn" | "danger" }) {
  const tone = accent === "danger" ? "text-red-400" : accent === "warn" ? "text-amber-400" : "text-primary";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className={`flex items-center gap-2 text-[11px] uppercase tracking-wider ${tone}`}>{icon}{label}</div>
      <div className="mt-2 text-2xl font-black tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-foreground/50">{sub}</div>}
    </div>
  );
}

function fmtPct(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(2)}%`;
}
function fmtMs(v: number | null | undefined): string {
  return v == null ? "—" : v < 1000 ? `${v} ms` : `${(v / 1000).toFixed(2)} s`;
}

function Sparkline({ series }: { series: Array<{ bucket: string; renewed: number; failed: number; payments: number; paymentFailures: number }> }) {
  if (!series.length) return <p className="text-center text-xs text-foreground/50 py-8">No activity in window.</p>;
  const w = 800, h = 160, pad = 20;
  const maxY = Math.max(1, ...series.map((s) => Math.max(s.renewed, s.failed, s.payments, s.paymentFailures)));
  const x = (i: number) => pad + (i / Math.max(1, series.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
  const path = (get: (p: (typeof series)[number]) => number) => series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40">
      <path d={path((p) => p.renewed)} fill="none" stroke="#22c55e" strokeWidth="2" />
      <path d={path((p) => p.failed)} fill="none" stroke="#ef4444" strokeWidth="2" />
      <path d={path((p) => p.payments)} fill="none" stroke="#3ea6ff" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x={pad} y={12} fontSize="10" fill="#22c55e">renewed</text>
      <text x={pad + 60} y={12} fontSize="10" fill="#ef4444">failed</text>
      <text x={pad + 110} y={12} fontSize="10" fill="#3ea6ff">payments</text>
    </svg>
  );
}
