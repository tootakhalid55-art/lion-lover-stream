import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Cpu, Key, KeyRound, Monitor, Sparkles, UserPlus, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dashboardV2 } from "@/lib/dashboard.functions";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.index.tsx" functionName="AdminDashboard" lineNumber={12} />
  ),
});

const TONES: Record<string, string> = {
  primary: "from-primary/80 to-accent/80",
  green: "from-emerald-500/80 to-lime-500/80",
  red: "from-red-500/80 to-orange-500/80",
  yellow: "from-yellow-500/80 to-amber-500/80",
  slate: "from-slate-500/80 to-slate-700/80",
  purple: "from-purple-500/80 to-fuchsia-500/80",
};
const PIE_COLORS = ["#3EA6FF", "#8A2EFF", "#22c55e", "#eab308", "#ef4444", "#06b6d4", "#f97316"];

function StatCard({ icon: Icon, label, value, hint, tone = "primary" }: any) {
  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/60">{label}</p>
          <p className="mt-2 text-3xl font-black">{value}</p>
          {hint && <p className="mt-1 text-xs text-foreground/50">{hint}</p>}
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${TONES[tone]} text-white shadow-lg`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: any) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3">
        <h3 className="font-black">{title}</h3>
        {subtitle && <p className="text-xs text-foreground/50">{subtitle}</p>}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

function AdminDashboard() {
  const fn = useServerFn(dashboardV2);
  const q = useQuery({ queryKey: ["admin", "dashboard-v2"], queryFn: () => fn(), refetchInterval: 30_000, throwOnError: true });
  const d = q.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/90">Overview</p>
          <h1 className="text-3xl font-black">لوحة القيادة</h1>
          <p className="text-sm text-foreground/60 mt-1">مؤشرات فورية عن الحسابات والاشتراكات والأمان</p>
        </div>
        <Link to="/admin/users" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-bold text-white shadow-lg">
          <UserPlus className="h-4 w-4" />
          إدارة المستخدمين
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Users} label="إجمالي الحسابات" value={d?.kpis.totalUsers ?? "…"} />
        <StatCard icon={CheckCircle2} label="نشطة" value={d?.kpis.activeUsers ?? "…"} tone="green" />
        <StatCard icon={Activity} label="متصلون الآن" value={d?.kpis.onlineNow ?? "…"} tone="green" hint="خلال ٥ دقائق" />
        <StatCard icon={Key} label="رخص نشِطة" value={d?.kpis.activeLicenses ?? "…"} tone="purple" />
        <StatCard icon={KeyRound} label="رخص منتهية" value={d?.kpis.expiredLicenses ?? "…"} tone="red" />
        <StatCard icon={Monitor} label="أجهزة مرتبطة" value={d?.kpis.devices ?? "…"} />
        <StatCard icon={Cpu} label="جلسات نشطة" value={d?.kpis.activeSessions ?? "…"} />
        <StatCard icon={Sparkles} label="تفعيلات اليوم" value={d?.kpis.activationsToday ?? "…"} tone="purple" />
        <StatCard icon={AlertTriangle} label="فشل دخول (٢٤س)" value={d?.kpis.failedLogins24h ?? "…"} tone="red" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="محاولات الدخول (٣٠ يوم)" subtitle="ناجحة مقابل فاشلة">
            <ResponsiveContainer>
              <AreaChart data={d?.series.logins ?? []}>
                <defs>
                  <linearGradient id="ok" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#ffffff40" tick={{ fontSize: 10 }} />
                <YAxis stroke="#ffffff40" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#0B0B0F", border: "1px solid #ffffff20", borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="ok" name="ناجحة" stroke="#22c55e" fill="url(#ok)" strokeWidth={2} />
                <Area type="monotone" dataKey="fail" name="فاشلة" stroke="#ef4444" fill="url(#fail)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <ChartCard title="توزيع الباقات" subtitle="عدد الرخص المُفعّلة (٣٠ يوم)">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={d?.packageDistribution ?? []} dataKey="count" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {(d?.packageDistribution ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0B0B0F", border: "1px solid #ffffff20", borderRadius: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="حسابات جديدة (٣٠ يوم)">
          <ResponsiveContainer>
            <BarChart data={d?.series.newUsers ?? []}>
              <XAxis dataKey="date" stroke="#ffffff40" tick={{ fontSize: 10 }} />
              <YAxis stroke="#ffffff40" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#0B0B0F", border: "1px solid #ffffff20", borderRadius: 12 }} />
              <Bar dataKey="count" fill="#3EA6FF" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="تفعيلات الرخص (٣٠ يوم)">
          <ResponsiveContainer>
            <AreaChart data={d?.series.activations ?? []}>
              <defs>
                <linearGradient id="acts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8A2EFF" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#8A2EFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#ffffff40" tick={{ fontSize: 10 }} />
              <YAxis stroke="#ffffff40" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#0B0B0F", border: "1px solid #ffffff20", borderRadius: 12 }} />
              <Area type="monotone" dataKey="count" stroke="#8A2EFF" fill="url(#acts)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
