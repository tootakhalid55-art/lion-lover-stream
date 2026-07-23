import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Search, ChevronRight, Layers } from "lucide-react";
import { searchTraces, type TraceHit } from "@/lib/workflow-trace-search.functions";
import { getWorkflowTrace, type TraceStep } from "@/lib/workflow-trace.functions";
import { RouteError } from "@/components/RouteError";
import { AdminHeader, Pill } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/billing/traces")({
  head: () => ({ meta: [
    { title: "Billing Trace Center — Nova TV" },
    { name: "description", content: "Search and inspect end-to-end billing traces by correlation ID or entity." },
    { name: "robots", content: "noindex,nofollow" },
  ]}),
  component: TracesPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.billing.traces.tsx" functionName="TracesPage" lineNumber={22} />
  ),
});

const KINDS: Array<{ id: "correlation" | "invoice" | "subscription" | "payment" | "order" | "webhook" | "organization"; label: string }> = [
  { id: "correlation", label: "Correlation ID" },
  { id: "invoice", label: "Invoice ID" },
  { id: "subscription", label: "Subscription ID" },
  { id: "payment", label: "Payment Intent" },
  { id: "order", label: "Order ID" },
  { id: "webhook", label: "Webhook / Event ID" },
  { id: "organization", label: "Organization ID" },
];

function TracesPage() {
  const searchFn = useServerFn(searchTraces);
  const traceFn = useServerFn(getWorkflowTrace);
  const [kind, setKind] = useState<typeof KINDS[number]["id"]>("correlation");
  const [value, setValue] = useState("");
  const [hits, setHits] = useState<TraceHit[]>([]);
  const [selected, setSelected] = useState<{ cid: string; steps: TraceStep[] } | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const search = useMutation({
    mutationFn: async () => searchFn({ data: { kind, value } }),
    onSuccess: (r) => { setHits(r.hits); setSelected(null); },
  });
  const load = useMutation({
    mutationFn: async (cid: string) => traceFn({ data: { correlationId: cid } }),
    onSuccess: (r) => { setSelected({ cid: r.correlationId, steps: r.steps }); setExpanded({}); },
  });

  return (
    <div dir="ltr" className="space-y-6">
      <AdminHeader title="Trace Center" subtitle="Cross-table timeline for any billing operation." />

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}
            className="rounded-lg bg-black/40 px-3 py-2 text-sm ring-1 ring-white/10">
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <input value={value} onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) search.mutate(); }}
            placeholder="Enter value…"
            className="flex-1 min-w-[260px] rounded-lg bg-black/40 px-3 py-2 text-sm font-mono ring-1 ring-white/10 focus:ring-2 focus:ring-primary" />
          <button disabled={!value.trim() || search.isPending} onClick={() => search.mutate()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-black disabled:opacity-50 inline-flex items-center gap-2">
            <Search className="h-4 w-4" /> {search.isPending ? "Searching…" : "Search"}
          </button>
        </div>
        {search.error && <p className="mt-2 text-xs text-red-300">{String((search.error as Error).message)}</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-[380px,1fr]">
        <section className="rounded-2xl border border-white/10 bg-white/5">
          <header className="border-b border-white/10 px-4 py-3 text-sm font-bold flex items-center gap-2">
            <Layers className="h-4 w-4" /> Matches ({hits.length})
          </header>
          <ul className="max-h-[70vh] overflow-auto divide-y divide-white/5">
            {hits.length === 0 && <li className="px-4 py-8 text-center text-xs text-foreground/50">Run a search to see correlated traces.</li>}
            {hits.map((h) => (
              <li key={h.correlationId}>
                <button onClick={() => load.mutate(h.correlationId)}
                  className={`w-full px-4 py-3 text-left hover:bg-white/5 ${selected?.cid === h.correlationId ? "bg-primary/10" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs truncate">{h.correlationId}</span>
                    <ChevronRight className="h-4 w-4 text-foreground/40 shrink-0" />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-foreground/50">
                    <span>{h.eventCount} events · {h.refType}</span>
                    <span>{new Date(h.lastSeen).toLocaleString()}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5">
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="text-sm font-bold">Timeline {selected && <span className="ml-2 font-mono text-[11px] text-foreground/50">{selected.cid}</span>}</div>
            <div className="text-xs text-foreground/50">{selected?.steps.length ?? 0} steps</div>
          </header>
          <div className="max-h-[70vh] overflow-auto p-4">
            {!selected && <p className="text-center text-xs text-foreground/50 py-16">Pick a correlation ID to inspect its cross-service timeline.</p>}
            {selected && selected.steps.length === 0 && <p className="text-center text-xs text-foreground/50 py-16">No events recorded for this correlation ID.</p>}
            {selected && (
              <ol className="relative border-l border-white/10 pl-6 space-y-3">
                {selected.steps.map((s, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/20" />
                    <button onClick={() => setExpanded((e) => ({ ...e, [i]: !e[i] }))}
                      className="w-full text-left rounded-lg bg-black/30 p-3 ring-1 ring-white/5 hover:ring-white/20">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Pill tone={pillTone(s.source)}>{s.source}</Pill>
                          <span className="font-mono text-xs">{s.type}</span>
                        </div>
                        <span className="text-[11px] text-foreground/50">{new Date(s.at).toLocaleString()}</span>
                      </div>
                      {s.refId && <div className="mt-1 text-[11px] text-foreground/50">{s.refType ?? "ref"}: <span className="font-mono">{s.refId}</span></div>}
                      {expanded[i] && s.payload && (
                        <pre className="mt-2 max-h-64 overflow-auto rounded bg-black/40 p-2 text-[11px] leading-tight text-foreground/80">{prettyJson(s.payload)}</pre>
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function pillTone(source: string): "blue" | "green" | "purple" | "red" | "slate" | "yellow" {
  if (source === "subscription_events") return "purple";
  if (source === "billing_events") return "blue";
  if (source === "payment_intents") return "green";
  if (source === "gateway_webhook_events") return "yellow";
  if (source === "webhook_deliveries") return "yellow";
  if (source === "audit_logs") return "slate";
  if (source === "outbox") return "blue";
  return "slate";
}
function prettyJson(s: string): string {
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
}
