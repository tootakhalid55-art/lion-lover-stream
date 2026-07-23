import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { listDevices, renameDevice, trustDevice, revokeDevice, unblockDevice, forceLogoutDevice } from "@/lib/devices.functions";
import { useCapabilities } from "@/hooks/use-capabilities";
import { AdminHeader, Pill, EmptyState, fmt, relTime, exportUrl } from "@/components/admin/ui";
import { Ban, Check, Download, LogOut, MonitorSmartphone, Pencil, ShieldCheck, ShieldOff } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/admin/devices")({
  component: DevicesPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.devices.tsx" functionName="DevicesPage" lineNumber={13} />
  ),
});

function DevicesPage() {
  const caps = useCapabilities();
  const qc = useQueryClient();
  const listFn = useServerFn(listDevices);
  const renameFn = useServerFn(renameDevice);
  const trustFn = useServerFn(trustDevice);
  const revokeFn = useServerFn(revokeDevice);
  const unblockFn = useServerFn(unblockDevice);
  const forceLogoutFn = useServerFn(forceLogoutDevice);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "trusted" | "blocked">("all");
  const [token, setToken] = useState<string | null>(null);
  useState(() => { supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null)); return 0; });

  const q = useQuery({
    queryKey: ["admin", "devices", { search, status }],
    queryFn: () => listFn({ data: { search: search || undefined, status } }),
  });

  async function invalidate() { await qc.invalidateQueries({ queryKey: ["admin", "devices"] }); }

  async function onRename(id: string, current: string) {
    const name = window.prompt("اسم الجهاز الجديد", current || "");
    if (!name) return;
    await renameFn({ data: { id, name } }); await invalidate();
  }
  async function onTrust(id: string, trusted: boolean) { await trustFn({ data: { id, trusted } }); await invalidate(); }
  async function onRevoke(id: string) {
    if (!confirm("إلغاء تسجيل هذا الجهاز وإنهاء جلساته؟")) return;
    await revokeFn({ data: { id } }); await invalidate();
  }
  async function onUnblock(id: string) { await unblockFn({ data: { id } }); await invalidate(); }
  async function onForceLogout(id: string) { await forceLogoutFn({ data: { id } }); await invalidate(); }

  return (
    <div className="space-y-4">
      <AdminHeader title="الأجهزة" subtitle="عرض وإدارة جميع الأجهزة المسجّلة"
        actions={<>
          {caps.canExport && <>
            <a href={exportUrl("devices", "csv", token)} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"><Download className="h-3.5 w-3.5" /> CSV</a>
            <a href={exportUrl("devices", "xlsx", token)} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"><Download className="h-3.5 w-3.5" /> Excel</a>
          </>}
        </>} />

      <div className="glass rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالمستخدم / IP / الجهاز…"
          className="flex-1 min-w-[220px] rounded-xl bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-foreground/40" />
        {(["all", "active", "trusted", "blocked"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === s ? "bg-primary text-white" : "bg-white/5 hover:bg-white/10"}`}>
            {s === "all" ? "الكل" : s === "active" ? "نشِطة" : s === "trusted" ? "موثوقة" : "محظورة"}
          </button>
        ))}
      </div>

      {q.isLoading ? <div className="text-foreground/50 p-8 text-center">جارٍ التحميل…</div>
        : !q.data?.length ? <EmptyState>لا توجد أجهزة</EmptyState>
        : <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-foreground/60">
              <tr>
                <th className="text-right p-3">المستخدم</th>
                <th className="text-right p-3">الجهاز</th>
                <th className="text-right p-3">النظام</th>
                <th className="text-right p-3">المتصفح</th>
                <th className="text-right p-3">IP / الدولة</th>
                <th className="text-right p-3">أول ظهور</th>
                <th className="text-right p-3">آخر نشاط</th>
                <th className="text-right p-3">الحالة</th>
                <th className="text-right p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((d: any) => (
                <tr key={d.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="p-3">{d.profiles?.username ?? "—"}</td>
                  <td className="p-3"><div className="flex items-center gap-2"><MonitorSmartphone className="h-4 w-4 text-foreground/50" /><span>{d.name || d.device_name || "—"}</span></div></td>
                  <td className="p-3">{d.os || "—"}</td>
                  <td className="p-3">{d.browser || "—"}</td>
                  <td className="p-3 font-mono text-xs">{d.ip || "—"}{d.country ? ` · ${d.country}` : ""}</td>
                  <td className="p-3 text-foreground/60">{fmt(d.first_login_at || d.bound_at)}</td>
                  <td className="p-3 text-foreground/60">{relTime(d.last_activity_at || d.last_seen)}</td>
                  <td className="p-3">
                    {d.blocked_at ? <Pill tone="red">محظور</Pill>
                      : d.trusted_at ? <Pill tone="green">موثوق</Pill>
                      : <Pill tone="slate">عادي</Pill>}
                  </td>
                  <td className="p-3">
                    {caps.canManageDevices && (
                      <div className="flex items-center gap-1">
                        <button title="إعادة تسمية" onClick={() => onRename(d.id, d.name || d.device_name)} className="rounded p-1.5 hover:bg-white/10"><Pencil className="h-3.5 w-3.5" /></button>
                        {d.trusted_at
                          ? <button title="إلغاء الثقة" onClick={() => onTrust(d.id, false)} className="rounded p-1.5 hover:bg-white/10"><ShieldOff className="h-3.5 w-3.5" /></button>
                          : <button title="جهاز موثوق" onClick={() => onTrust(d.id, true)} className="rounded p-1.5 hover:bg-white/10"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /></button>}
                        <button title="فرض خروج" onClick={() => onForceLogout(d.id)} className="rounded p-1.5 hover:bg-white/10"><LogOut className="h-3.5 w-3.5 text-yellow-300" /></button>
                        {d.blocked_at
                          ? <button title="إلغاء الحظر" onClick={() => onUnblock(d.id)} className="rounded p-1.5 hover:bg-white/10"><Check className="h-3.5 w-3.5 text-emerald-400" /></button>
                          : <button title="حظر / إلغاء" onClick={() => onRevoke(d.id)} className="rounded p-1.5 hover:bg-white/10"><Ban className="h-3.5 w-3.5 text-red-400" /></button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </div>
  );
}
