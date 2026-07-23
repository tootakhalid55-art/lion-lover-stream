import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Clock, Cpu, Monitor, Sparkles, UserPlus, Users } from "lucide-react";
import { adminStats } from "@/lib/auth.functions";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.index.tsx" functionName="AdminDashboard" lineNumber={12} />
  ),
});

function StatCard({ icon: Icon, label, value, hint, tone = "primary" }: any) {
  const toneMap: Record<string, string> = {
    primary: "from-primary/80 to-accent/80",
    green: "from-emerald-500/80 to-lime-500/80",
    red: "from-red-500/80 to-orange-500/80",
    slate: "from-slate-500/80 to-slate-700/80",
  };
  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/60">{label}</p>
          <p className="mt-2 text-3xl font-black">{value}</p>
          {hint && <p className="mt-1 text-xs text-foreground/50">{hint}</p>}
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${toneMap[tone]} text-white shadow-lg`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const statsFn = useServerFn(adminStats);
  const q = useQuery({ queryKey: ["admin", "stats"], queryFn: () => statsFn(), refetchInterval: 30_000, throwOnError: true });
  const s = q.data;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/90">Overview</p>
          <h1 className="text-3xl font-black">نظرة عامة</h1>
        </div>
        <Link to="/admin/users" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-bold text-white shadow-lg">
          <UserPlus className="h-4 w-4" />
          إدارة المستخدمين
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Users} label="إجمالي الحسابات" value={s?.total ?? "…"} />
        <StatCard icon={CheckCircle2} label="مفعّلة" value={s?.active ?? "…"} tone="green" />
        <StatCard icon={Clock} label="منتهية" value={s?.expired ?? "…"} tone="red" />
        <StatCard icon={Sparkles} label="معلّقة" value={s?.suspended ?? "…"} tone="slate" />
        <StatCard icon={Activity} label="متصلون الآن" value={s?.online ?? "…"} tone="green" hint="خلال ٥ دقائق" />
        <StatCard icon={Monitor} label="أجهزة مرتبطة" value={s?.devices ?? "…"} />
        <StatCard icon={Cpu} label="جلسات نشطة" value={s?.sessions ?? "…"} />
        <StatCard icon={UserPlus} label="جدد اليوم" value={s?.newToday ?? "…"} />
      </div>
    </div>
  );
}
