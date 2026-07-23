import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { systemHealth } from "@/lib/system-health.functions";
import { useCapabilities } from "@/hooks/use-capabilities";
import { AdminHeader, Pill, fmt } from "@/components/admin/ui";
import { Activity, Database, Gauge, HardDrive, ListChecks, Radar } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/admin/system")({
  component: SystemPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.system.tsx" functionName="SystemPage" lineNumber={11} />
  ),
});

function Tile({ icon: Icon, label, value, hint, tone = "slate" }: any) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">{label}</p>
          <p className="mt-2 text-2xl font-black">{value}</p>
          {hint && <p className="text-xs text-foreground/50 mt-1">{hint}</p>}
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-xl bg-white/5 ${tone === "red" ? "text-red-400" : tone === "green" ? "text-emerald-400" : "text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SystemPage() {
  const caps = useCapabilities();
  const fn = useServerFn(systemHealth);
  const q = useQuery({ queryKey: ["system-health"], queryFn: () => fn(), refetchInterval: 15_000 });

  if (!caps.canManageSystem) return <div className="glass rounded-2xl p-8 text-center text-foreground/60">صلاحيات غير كافية.</div>;

  const h = q.data;
  return (
    <div className="space-y-4">
      <AdminHeader title="صحّة النظام" subtitle={h ? `آخر تحديث ${fmt(h.takenAt)}` : "جارٍ القياس…"} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Tile icon={Database} label="قاعدة البيانات" value={h?.db.ok ? "متصلة" : "قطع"} tone={h?.db.ok ? "green" : "red"} hint={`${h?.db.latencyMs ?? "—"} ms`} />
        <Tile icon={Gauge} label="زمن الاستجابة" value={`${h?.api.latencyMs ?? "…"} ms`} />
        <Tile icon={Activity} label="جلسات نشطة" value={h?.activeSessions ?? "…"} />
        <Tile icon={Radar} label="مهام فاشلة (٢٤س)" value={h?.failedJobs24h ?? 0} tone={h?.failedJobs24h ? "red" : "slate"} />
        <Tile icon={HardDrive} label="التخزين" value={h?.storage.buckets ?? 0} hint={h?.storage.note} />
        <Tile icon={ListChecks} label="طوابير" value={h?.queue.pending ?? 0} hint={h?.queue.note} />
      </div>

      <div className="glass rounded-2xl p-4">
        <h3 className="font-black mb-3">المهام الخلفية</h3>
        <div className="space-y-2">
          {h?.backgroundTasks.map((t: any) => (
            <div key={t.name} className="flex items-center justify-between border-t border-white/5 pt-2 first:border-t-0 first:pt-0">
              <span className="text-sm">{t.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-foreground/50">{t.lastRun ? fmt(t.lastRun) : "—"}</span>
                <Pill tone={t.status === "running" ? "green" : "slate"}>{t.status}</Pill>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
