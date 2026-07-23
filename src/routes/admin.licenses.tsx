import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Key, RefreshCw, ShieldOff } from "lucide-react";
import { listLicenses, listPackages, renewLicense, revokeLicense } from "@/lib/licensing.functions";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/admin/licenses")({
  component: LicensesPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.licenses.tsx" functionName="LicensesPage" lineNumber={12} />
  ),
});

function LicensesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listLicenses);
  const pkgFn = useServerFn(listPackages);
  const renewFn = useServerFn(renewLicense);
  const revokeFn = useServerFn(revokeLicense);
  const [status, setStatus] = useState<"all"|"active"|"expired"|"revoked"|"pending">("all");
  const [expiring, setExpiring] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const list = useQuery({
    queryKey: ["admin", "licenses", status, expiring, search],
    queryFn: () => listFn({ data: { status, expiringDays: expiring, search } }),
    throwOnError: true,
  });
  const packages = useQuery({ queryKey: ["admin", "packages"], queryFn: () => pkgFn(), throwOnError: true });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin"] });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/90">Licenses</p>
        <h1 className="text-3xl font-black">الرخص</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث برقم الرخصة…"
          className="flex-1 min-w-[220px] rounded-full bg-black/40 px-4 py-2.5 text-sm ring-1 ring-white/10 focus:ring-2 focus:ring-primary" />
        <select value={status} onChange={(e) => setStatus(e.target.value as any)}
          className="rounded-full bg-black/40 px-4 py-2.5 text-sm ring-1 ring-white/10">
          <option value="all">كل الحالات</option>
          <option value="active">نشطة</option>
          <option value="expired">منتهية</option>
          <option value="revoked">مُلغاة</option>
          <option value="pending">معلّقة</option>
        </select>
        <select value={expiring ?? ""} onChange={(e) => setExpiring(e.target.value ? Number(e.target.value) : null)}
          className="rounded-full bg-black/40 px-4 py-2.5 text-sm ring-1 ring-white/10">
          <option value="">كل التواريخ</option>
          <option value="1">تنتهي خلال يوم</option>
          <option value="7">تنتهي خلال أسبوع</option>
          <option value="30">تنتهي خلال شهر</option>
        </select>
      </div>

      <div className="glass-strong rounded-2xl overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-white/5 text-[11px] uppercase text-foreground/60">
            <tr>
              <th className="px-4 py-3">الرخصة</th>
              <th className="px-4 py-3">المستخدم</th>
              <th className="px-4 py-3">الباقة</th>
              <th className="px-4 py-3">النوع</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">الانتهاء</th>
              <th className="px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-foreground/50">جارٍ التحميل…</td></tr>}
            {list.data?.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-foreground/50">لا نتائج</td></tr>}
            {(list.data ?? []).map((l: any) => (
              <tr key={l.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Key className="h-3.5 w-3.5 text-primary/70" />
                    <span dir="ltr" className="font-mono text-xs">{l.license_key}</span>
                    <button onClick={() => navigator.clipboard?.writeText(l.license_key)} className="text-foreground/40 hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="font-bold">{l.profiles?.username}</p>
                  <p className="text-xs text-foreground/50">{l.profiles?.display_name || "—"}</p>
                </td>
                <td className="px-4 py-3">{l.packages?.name ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{l.license_type}</td>
                <td className="px-4 py-3"><Badge status={l.status} /></td>
                <td className="px-4 py-3 text-xs text-foreground/70">{l.expires_at ? new Date(l.expires_at).toLocaleDateString("ar") : "دائم"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button title="تجديد" onClick={async () => { await renewFn({ data: { id: l.id } }); invalidate(); }}
                      className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 hover:bg-white/10"><RefreshCw className="h-3.5 w-3.5" /></button>
                    <button title="إلغاء" onClick={async () => { if (confirm("إلغاء الرخصة؟")) { await revokeFn({ data: { id: l.id } }); invalidate(); } }}
                      className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20"><ShieldOff className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    expired: "bg-red-500/15 text-red-300 ring-red-500/30",
    revoked: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
    pending: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  };
  const label: Record<string, string> = { active: "نشطة", expired: "منتهية", revoked: "مُلغاة", pending: "معلّقة" };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${tone[status]}`}>{label[status] ?? status}</span>;
}
