import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { listSessions, terminateSession, terminateOtherSessions, forceReauth } from "@/lib/sessions.functions";
import { useCapabilities } from "@/hooks/use-capabilities";
import { AdminHeader, Pill, EmptyState, fmt, relTime, exportUrl } from "@/components/admin/ui";
import { Download, KeyRound, LogOut, XCircle } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/admin/sessions")({
  component: SessionsPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.sessions.tsx" functionName="SessionsPage" lineNumber={13} />
  ),
});

function SessionsPage() {
  const caps = useCapabilities();
  const qc = useQueryClient();
  const listFn = useServerFn(listSessions);
  const termFn = useServerFn(terminateSession);
  const termOthersFn = useServerFn(terminateOtherSessions);
  const forceReauthFn = useServerFn(forceReauth);
  const [state, setState] = useState<"active" | "expired" | "all">("active");
  const [search, setSearch] = useState("");
  const [token, setToken] = useState<string | null>(null);
  useState(() => { supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null)); return 0; });

  const q = useQuery({
    queryKey: ["admin", "sessions", { state, search }],
    queryFn: () => listFn({ data: { state, search: search || undefined } }),
    refetchInterval: 30_000,
  });

  async function invalidate() { await qc.invalidateQueries({ queryKey: ["admin", "sessions"] }); }

  async function onTerminate(id: string) {
    if (!confirm("إنهاء هذه الجلسة؟")) return;
    await termFn({ data: { id } }); await invalidate();
  }
  async function onTerminateOthers(userId: string, keep: string) {
    if (!confirm("إنهاء جميع الجلسات الأخرى لهذا المستخدم؟")) return;
    await termOthersFn({ data: { userId, keepSessionId: keep } }); await invalidate();
  }
  async function onForceReauth(userId: string) {
    if (!confirm("فرض إعادة المصادقة على المستخدم؟ سيُطرد من جميع أجهزته.")) return;
    await forceReauthFn({ data: { userId } }); await invalidate();
  }

  const cutoff = Date.now() - 5 * 60_000;

  return (
    <div className="space-y-4">
      <AdminHeader title="الجلسات" subtitle="متابعة الجلسات النشطة والمنتهية"
        actions={caps.canExport ? <>
          <a href={exportUrl("sessions", "csv", token)} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"><Download className="h-3.5 w-3.5" /> CSV</a>
          <a href={exportUrl("sessions", "xlsx", token)} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"><Download className="h-3.5 w-3.5" /> Excel</a>
        </> : null} />

      <div className="glass rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالمستخدم / IP…"
          className="flex-1 min-w-[220px] rounded-xl bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-foreground/40" />
        {(["active", "expired", "all"] as const).map((s) => (
          <button key={s} onClick={() => setState(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${state === s ? "bg-primary text-white" : "bg-white/5 hover:bg-white/10"}`}>
            {s === "active" ? "نشطة" : s === "expired" ? "منتهية" : "الكل"}
          </button>
        ))}
      </div>

      {q.isLoading ? <div className="text-foreground/50 p-8 text-center">جارٍ التحميل…</div>
        : !q.data?.length ? <EmptyState>لا توجد جلسات</EmptyState>
        : <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-foreground/60">
              <tr>
                <th className="text-right p-3">المستخدم</th>
                <th className="text-right p-3">IP / الدولة</th>
                <th className="text-right p-3">جهاز</th>
                <th className="text-right p-3">بدأت</th>
                <th className="text-right p-3">آخر نشاط</th>
                <th className="text-right p-3">المدّة</th>
                <th className="text-right p-3">الحالة</th>
                <th className="text-right p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((s: any) => {
                const active = !s.revoked_at;
                const online = active && new Date(s.last_seen).getTime() > cutoff;
                const duration = Math.max(0, (new Date(s.revoked_at || s.last_seen).getTime() - new Date(s.created_at).getTime()) / 60_000);
                return (
                  <tr key={s.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="p-3">{s.profiles?.username ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{s.ip || "—"}{s.country ? ` · ${s.country}` : ""}</td>
                    <td className="p-3 font-mono text-[11px] text-foreground/50">{s.device_id?.slice(0, 12) ?? "—"}</td>
                    <td className="p-3 text-foreground/60">{fmt(s.created_at)}</td>
                    <td className="p-3 text-foreground/60">{relTime(s.last_seen)}</td>
                    <td className="p-3 text-foreground/60">{duration < 60 ? `${Math.round(duration)} د` : `${(duration / 60).toFixed(1)} س`}</td>
                    <td className="p-3">
                      {online ? <Pill tone="green">متصل</Pill>
                        : active ? <Pill tone="blue">نشطة</Pill>
                        : <Pill tone="slate">منتهية</Pill>}
                    </td>
                    <td className="p-3">
                      {caps.canManageSessions && active && (
                        <div className="flex items-center gap-1">
                          <button title="إنهاء الجلسة" onClick={() => onTerminate(s.id)} className="rounded p-1.5 hover:bg-white/10"><XCircle className="h-3.5 w-3.5 text-red-400" /></button>
                          <button title="إنهاء جلسات أخرى" onClick={() => onTerminateOthers(s.user_id, s.id)} className="rounded p-1.5 hover:bg-white/10"><LogOut className="h-3.5 w-3.5 text-yellow-300" /></button>
                          <button title="فرض إعادة مصادقة" onClick={() => onForceReauth(s.user_id)} className="rounded p-1.5 hover:bg-white/10"><KeyRound className="h-3.5 w-3.5 text-primary" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>}
    </div>
  );
}
