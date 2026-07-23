import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { adminListUsers } from "@/lib/auth.functions";
import { listPackages } from "@/lib/licensing.functions";
import { bulkPreview, bulkExecute } from "@/lib/bulk.functions";
import { useCapabilities } from "@/hooks/use-capabilities";
import { AdminHeader, EmptyState } from "@/components/admin/ui";
import { RouteError } from "@/components/RouteError";
import { AlertTriangle, Play } from "lucide-react";

export const Route = createFileRoute("/admin/bulk")({
  component: BulkPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.bulk.tsx" functionName="BulkPage" lineNumber={13} />
  ),
});

type Action = "activate" | "suspend" | "assign_package" | "revoke_devices" | "force_logout";

const ACTION_LABEL: Record<Action, string> = {
  activate: "تفعيل الحسابات", suspend: "تعليق الحسابات",
  assign_package: "تعيين باقة", revoke_devices: "إلغاء الأجهزة", force_logout: "فرض خروج",
};

function BulkPage() {
  const caps = useCapabilities();
  const qc = useQueryClient();
  const usersFn = useServerFn(adminListUsers);
  const packagesFn = useServerFn(listPackages);
  const previewFn = useServerFn(bulkPreview);
  const executeFn = useServerFn(bulkExecute);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<Action>("activate");
  const [packageId, setPackageId] = useState<string>("");
  const [preview, setPreview] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);

  const users = useQuery({ queryKey: ["admin", "users", "bulk"], queryFn: () => usersFn({ data: {} }) });
  const packages = useQuery({ queryKey: ["packages"], queryFn: () => packagesFn() });

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    if (!users.data) return;
    setSelected(selected.size === users.data.length ? new Set() : new Set(users.data.map((u: any) => u.id)));
  }
  async function onPreview() {
    setBusy(true);
    try {
      const res = await previewFn({ data: { action, userIds: [...selected], packageId: packageId || null } });
      setPreview(res.results);
    } finally { setBusy(false); }
  }
  async function onExecute() {
    if (!confirm(`تنفيذ العملية على ${selected.size} مستخدم؟ لا رجعة.`)) return;
    setBusy(true);
    try {
      await executeFn({ data: { action, userIds: [...selected], packageId: packageId || null } });
      setPreview(null); setSelected(new Set());
      await qc.invalidateQueries();
      alert("تم التنفيذ.");
    } catch (e: any) { alert(String(e?.message ?? e)); }
    finally { setBusy(false); }
  }

  if (!caps.canBulk) return <div className="glass rounded-2xl p-8 text-center text-foreground/60">لا تملك صلاحية العمليات الجماعية.</div>;

  return (
    <div className="space-y-4">
      <AdminHeader title="عمليات جماعية" subtitle="تنفيذ إجراء على مجموعة من المستخدمين" />
      <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">{selected.size} محدّد</span>
        <select value={action} onChange={(e) => setAction(e.target.value as Action)} className="rounded-xl bg-white/5 px-3 py-2 text-sm">
          {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {action === "assign_package" && (
          <select value={packageId} onChange={(e) => setPackageId(e.target.value)} className="rounded-xl bg-white/5 px-3 py-2 text-sm">
            <option value="">اختر باقة…</option>
            {packages.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <button disabled={!selected.size || busy || (action === "assign_package" && !packageId)}
          onClick={onPreview} className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold disabled:opacity-40">معاينة</button>
        {preview && (
          <button disabled={busy} onClick={onExecute}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
            <Play className="h-3.5 w-3.5" /> تنفيذ
          </button>
        )}
      </div>

      {preview && (
        <div className="glass-strong rounded-2xl p-4">
          <div className="flex items-center gap-2 text-yellow-300 mb-3">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-bold">معاينة التغييرات ({preview.length})</span>
          </div>
          <div className="max-h-80 overflow-auto text-xs font-mono space-y-1">
            {preview.map((r) => (
              <div key={r.targetId} className="border border-white/5 rounded p-2">
                <b>{r.username ?? r.targetId}</b> — {r.ok ? JSON.stringify(r.change) : `خطأ: ${r.error}`}
              </div>
            ))}
          </div>
        </div>
      )}

      {users.isLoading ? <div className="text-foreground/50 p-8 text-center">جارٍ…</div>
        : !users.data?.length ? <EmptyState>لا يوجد مستخدمون</EmptyState>
        : <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-foreground/60">
              <tr>
                <th className="p-3 text-right w-8"><input type="checkbox" checked={selected.size === users.data.length} onChange={toggleAll} /></th>
                <th className="p-3 text-right">المستخدم</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-right">الباقة</th>
                <th className="p-3 text-right">الأجهزة</th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((u: any) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="p-3"><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} /></td>
                  <td className="p-3">{u.username}</td>
                  <td className="p-3">{u.status}</td>
                  <td className="p-3">{u.packages?.name ?? "—"}</td>
                  <td className="p-3">{u.deviceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </div>
  );
}
