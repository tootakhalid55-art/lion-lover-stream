import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { listAuditLog } from "@/lib/security.functions";
import { supabase } from "@/integrations/supabase/client";
import { useCapabilities } from "@/hooks/use-capabilities";
import { AdminHeader, EmptyState, fmt, exportUrl, Pill } from "@/components/admin/ui";
import { Download } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/admin/audit")({
  component: AuditPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.audit.tsx" functionName="AuditPage" lineNumber={13} />
  ),
});

function AuditPage() {
  const caps = useCapabilities();
  const listFn = useServerFn(listAuditLog);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [token, setToken] = useState<string | null>(null);
  useState(() => { supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null)); return 0; });

  const q = useQuery({
    queryKey: ["audit", { search, action }],
    queryFn: () => listFn({ data: { search: search || undefined, action: action || undefined } }),
  });

  return (
    <div className="space-y-4">
      <AdminHeader title="سجل التدقيق" subtitle="كل عملية إدارية موثّقة"
        actions={caps.canExport ? <>
          <a href={exportUrl("audit", "csv", token)} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"><Download className="h-3.5 w-3.5" /> CSV</a>
          <a href={exportUrl("audit", "xlsx", token)} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"><Download className="h-3.5 w-3.5" /> Excel</a>
        </> : null} />

      <div className="glass rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث…"
          className="flex-1 min-w-[200px] rounded-xl bg-white/5 px-3 py-2 text-sm outline-none" />
        <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="نوع الإجراء…"
          className="w-40 rounded-xl bg-white/5 px-3 py-2 text-sm outline-none" />
      </div>

      {q.isLoading ? <div className="text-foreground/50 p-8 text-center">جارٍ التحميل…</div>
        : !q.data?.length ? <EmptyState>لا توجد سجلات</EmptyState>
        : <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-foreground/60">
              <tr>
                <th className="text-right p-3">الوقت</th>
                <th className="text-right p-3">المسؤول</th>
                <th className="text-right p-3">الإجراء</th>
                <th className="text-right p-3">الهدف</th>
                <th className="text-right p-3">IP</th>
                <th className="text-right p-3">قبل / بعد</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((r: any) => (
                <tr key={r.id} className="border-t border-white/5 align-top">
                  <td className="p-3 text-foreground/60">{fmt(r.created_at)}</td>
                  <td className="p-3">{r.actor?.username ?? "—"}</td>
                  <td className="p-3"><Pill tone="blue">{r.action}</Pill></td>
                  <td className="p-3">{r.target?.username ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{r.ip ?? "—"}</td>
                  <td className="p-3 font-mono text-[11px] text-foreground/50 max-w-[380px]">
                    {r.before_value && <div>قبل: {JSON.stringify(r.before_value)}</div>}
                    {r.after_value && <div>بعد: {JSON.stringify(r.after_value)}</div>}
                    {r.meta && Object.keys(r.meta).length > 0 && <div>{JSON.stringify(r.meta)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </div>
  );
}
