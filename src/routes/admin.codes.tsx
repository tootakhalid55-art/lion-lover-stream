import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Copy, Download, Plus, Ticket, Trash2, X } from "lucide-react";
import { createActivationCodes, listActivationCodes, listPackages, revokeActivationCode } from "@/lib/licensing.functions";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/admin/codes")({
  component: CodesPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.codes.tsx" functionName="CodesPage" lineNumber={12} />
  ),
});

function CodesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listActivationCodes);
  const pkgFn = useServerFn(listPackages);
  const createFn = useServerFn(createActivationCodes);
  const revokeFn = useServerFn(revokeActivationCode);
  const list = useQuery({ queryKey: ["admin", "codes"], queryFn: () => listFn(), throwOnError: true });
  const packages = useQuery({ queryKey: ["admin", "packages"], queryFn: () => pkgFn(), throwOnError: true });
  const [showCreate, setShowCreate] = useState(false);
  const [generated, setGenerated] = useState<string[] | null>(null);
  const create = useMutation({
    mutationFn: (v: any) => createFn({ data: v }),
    onSuccess: (rows: any) => {
      setGenerated(rows.map((r: any) => r.code));
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["admin", "codes"] });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/90">Activation Codes</p>
          <h1 className="text-3xl font-black">رموز التفعيل</h1>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> توليد رموز
        </button>
      </div>

      <div className="glass-strong rounded-2xl overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-white/5 text-[11px] uppercase text-foreground/60">
            <tr>
              <th className="px-4 py-3">الرمز</th>
              <th className="px-4 py-3">الباقة</th>
              <th className="px-4 py-3">الاستخدام</th>
              <th className="px-4 py-3">الانتهاء</th>
              <th className="px-4 py-3">مُستخدم</th>
              <th className="px-4 py-3">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground/50">…</td></tr>}
            {(list.data ?? []).map((c: any) => (
              <tr key={c.id} className="border-t border-white/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-3.5 w-3.5 text-primary/70" />
                    <span dir="ltr" className="font-mono text-xs">{c.code}</span>
                    <button onClick={() => navigator.clipboard?.writeText(c.code)} className="text-foreground/40 hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">{c.packages?.name ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{c.uses_count}/{c.uses_allowed}</td>
                <td className="px-4 py-3 text-xs text-foreground/70">{c.expires_at ? new Date(c.expires_at).toLocaleDateString("ar") : "—"}</td>
                <td className="px-4 py-3 text-xs text-foreground/70">{c.redeemed_at ? new Date(c.redeemed_at).toLocaleDateString("ar") : <span className="text-emerald-300">متاح</span>}</td>
                <td className="px-4 py-3">
                  <button onClick={async () => { if (confirm("حذف الرمز؟")) { await revokeFn({ data: { id: c.id } }); qc.invalidateQueries({ queryKey: ["admin", "codes"] }); } }}
                    className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20"><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateForm packages={packages.data ?? []} onClose={() => setShowCreate(false)} onSubmit={(v) => create.mutate(v)} busy={create.isPending} error={(create.error as any)?.message} />
      )}
      {generated && (
        <GeneratedList codes={generated} onClose={() => setGenerated(null)} />
      )}
    </div>
  );
}

const input = "w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-primary";

function CreateForm({ packages, onClose, onSubmit, busy, error }: any) {
  const [packageId, setPackageId] = useState<string>(packages[0]?.id ?? "");
  const [count, setCount] = useState<number>(10);
  const [overrideDays, setOverrideDays] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      packageId, count,
      overrideDays: overrideDays ? Number(overrideDays) : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      notes: notes || undefined,
    });
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm px-4 py-8" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-lg glass-strong rounded-3xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">توليد رموز تفعيل</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase text-foreground/70">الباقة</span>
          <select value={packageId} onChange={(e) => setPackageId(e.target.value)} required className={input}>
            {packages.map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.duration_days ?? "∞"} يوم</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase text-foreground/70">العدد (1-500)</span>
            <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase text-foreground/70">أيام مخصصة (اختياري)</span>
            <input type="number" min={1} value={overrideDays} onChange={(e) => setOverrideDays(e.target.value)} placeholder="من الباقة" className={input} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase text-foreground/70">تاريخ انتهاء الرمز نفسه (اختياري)</span>
          <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase text-foreground/70">ملاحظات</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
        </label>
        {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-full bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-black text-white disabled:opacity-60">
          {busy ? "…" : "توليد"}
        </button>
      </form>
    </div>
  );
}

function GeneratedList({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  function downloadCsv() {
    const blob = new Blob(["code\n" + codes.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nova-codes-${Date.now()}.csv`;
    a.click();
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm px-4 py-8" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg glass-strong rounded-3xl p-6 space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">تم توليد {codes.length} رمزًا</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <button onClick={downloadCsv} className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
          <Download className="h-4 w-4" /> تنزيل CSV
        </button>
        <pre dir="ltr" className="max-h-96 overflow-y-auto rounded-xl bg-black/40 p-3 text-xs font-mono ring-1 ring-white/10">
{codes.join("\n")}
        </pre>
      </div>
    </div>
  );
}
