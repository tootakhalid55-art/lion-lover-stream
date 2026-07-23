import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { listSecurityEvents, securityKpis } from "@/lib/security.functions";
import { useCapabilities } from "@/hooks/use-capabilities";
import { AdminHeader, Pill, EmptyState, fmt, exportUrl } from "@/components/admin/ui";
import { AlertTriangle, Download, ShieldAlert } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/admin/security")({
  component: SecurityPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.security.tsx" functionName="SecurityPage" lineNumber={13} />
  ),
});

const KIND_LABEL: Record<string, string> = {
  failed_login: "فشل دخول",
  successful_login: "دخول ناجح",
  password_change: "تغيير كلمة مرور",
  package_activated: "تفعيل باقة",
  license_activated: "تفعيل رخصة",
  device_registered: "تسجيل جهاز",
  new_device: "جهاز جديد",
  device_revoked: "إلغاء جهاز",
  session_revoked: "إنهاء جلسة",
  suspicious: "نشاط مريب",
  account_locked: "قفل حساب",
  account_unlocked: "فتح حساب",
  bulk_op: "عملية جماعية",
  job_failed: "فشل مهمة",
};

const KIND_TONE: Record<string, "green" | "red" | "yellow" | "slate" | "blue" | "purple"> = {
  failed_login: "red", account_locked: "red", suspicious: "red", job_failed: "red",
  new_device: "yellow", session_revoked: "yellow", device_revoked: "yellow",
  successful_login: "green", account_unlocked: "green", package_activated: "green", license_activated: "green",
  password_change: "blue", device_registered: "blue",
  bulk_op: "purple",
};

function KpiCard({ label, value, tone = "slate", icon: Icon }: any) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">{label}</p>
          <p className="mt-2 text-2xl font-black">{value}</p>
        </div>
        <div className={`grid h-9 w-9 place-items-center rounded-lg bg-white/5 ${tone === "red" ? "text-red-400" : tone === "yellow" ? "text-yellow-300" : "text-primary"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function SecurityPage() {
  const caps = useCapabilities();
  const kpiFn = useServerFn(securityKpis);
  const listFn = useServerFn(listSecurityEvents);
  const [kind, setKind] = useState<string>("");
  const [search, setSearch] = useState("");
  const [token, setToken] = useState<string | null>(null);
  useState(() => { supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null)); return 0; });

  const kpis = useQuery({ queryKey: ["sec", "kpi"], queryFn: () => kpiFn(), refetchInterval: 60_000 });
  const events = useQuery({
    queryKey: ["sec", "events", { kind, search }],
    queryFn: () => listFn({ data: { kind: kind || undefined, search: search || undefined } }),
  });

  return (
    <div className="space-y-4">
      <AdminHeader title="مركز الأمان" subtitle="سجل الأحداث والمحاولات المشبوهة"
        actions={caps.canExport ? <>
          <a href={exportUrl("security", "csv", token)} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"><Download className="h-3.5 w-3.5" /> CSV</a>
          <a href={exportUrl("security", "xlsx", token)} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"><Download className="h-3.5 w-3.5" /> Excel</a>
        </> : null} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="فشل دخول (٢٤س)" value={kpis.data?.failedLogins24h ?? "…"} tone="red" icon={AlertTriangle} />
        <KpiCard label="دخول ناجح (٢٤س)" value={kpis.data?.successfulLogins24h ?? "…"} icon={ShieldAlert} />
        <KpiCard label="أقفال (٢٤س)" value={kpis.data?.accountLocks24h ?? "…"} tone="red" icon={AlertTriangle} />
        <KpiCard label="أجهزة جديدة (٧ي)" value={kpis.data?.newDevices7d ?? "…"} tone="yellow" icon={ShieldAlert} />
        <KpiCard label="مريبة (٧ي)" value={kpis.data?.suspicious7d ?? "…"} tone="red" icon={AlertTriangle} />
        <KpiCard label="تغيير كلمة (٧ي)" value={kpis.data?.passwordChanges7d ?? "…"} icon={ShieldAlert} />
      </div>

      <div className="glass rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث…"
          className="flex-1 min-w-[200px] rounded-xl bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-foreground/40" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-xl bg-white/5 px-3 py-2 text-sm outline-none">
          <option value="">كل الأنواع</option>
          {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      {events.isLoading ? <div className="text-foreground/50 p-8 text-center">جارٍ التحميل…</div>
        : !events.data?.length ? <EmptyState>لا توجد أحداث</EmptyState>
        : <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-foreground/60">
              <tr>
                <th className="text-right p-3">الوقت</th>
                <th className="text-right p-3">النوع</th>
                <th className="text-right p-3">الخطورة</th>
                <th className="text-right p-3">المستخدم</th>
                <th className="text-right p-3">IP</th>
                <th className="text-right p-3">تفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {events.data.map((e: any) => (
                <tr key={e.id} className="border-t border-white/5">
                  <td className="p-3 text-foreground/60">{fmt(e.created_at)}</td>
                  <td className="p-3"><Pill tone={KIND_TONE[e.kind] ?? "slate"}>{KIND_LABEL[e.kind] ?? e.kind}</Pill></td>
                  <td className="p-3"><Pill tone={e.severity === "critical" ? "red" : e.severity === "warn" ? "yellow" : "slate"}>{e.severity}</Pill></td>
                  <td className="p-3">{e.profiles?.username ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{e.ip ?? "—"}</td>
                  <td className="p-3 font-mono text-[11px] text-foreground/50 max-w-[280px] truncate">{JSON.stringify(e.meta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </div>
  );
}
