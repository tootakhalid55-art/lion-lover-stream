import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Package as PackageIcon, Pencil, Plus, Trash2, X } from "lucide-react";
import { deletePackage, listPackages, upsertPackage } from "@/lib/licensing.functions";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/admin/packages")({
  component: PackagesPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.packages.tsx" functionName="PackagesPage" lineNumber={12} />
  ),
});

const TIERS = [
  { value: "trial", label: "تجريبي" },
  { value: "monthly", label: "شهري" },
  { value: "quarterly", label: "ربع سنوي" },
  { value: "semi_annual", label: "نصف سنوي" },
  { value: "annual", label: "سنوي" },
  { value: "lifetime", label: "مدى الحياة" },
  { value: "custom", label: "مخصص" },
] as const;

type Pkg = Awaited<ReturnType<typeof listPackages>>[number];

function PackagesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPackages);
  const upsertFn = useServerFn(upsertPackage);
  const deleteFn = useServerFn(deletePackage);
  const list = useQuery({ queryKey: ["admin", "packages"], queryFn: () => listFn(), throwOnError: true });
  const [editing, setEditing] = useState<Pkg | "new" | null>(null);

  const save = useMutation({
    mutationFn: (v: any) => upsertFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); setEditing(null); },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/90">Packages</p>
          <h1 className="text-3xl font-black">الباقات والاشتراكات</h1>
        </div>
        <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-bold text-white shadow-lg">
          <Plus className="h-4 w-4" /> باقة جديدة
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(list.data ?? []).map((p) => (
          <div key={p.id} className={`glass-strong rounded-2xl p-5 ${p.is_active ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary/70 to-accent/70 text-white"><PackageIcon className="h-4 w-4" /></div>
                  <div>
                    <p className="text-lg font-black truncate">{p.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-foreground/50">{TIERS.find(t => t.value === p.tier)?.label ?? p.tier}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(p)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 hover:bg-white/10"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={async () => { if (confirm(`حذف ${p.name}؟`)) { await deleteFn({ data: { id: p.id } }); qc.invalidateQueries({ queryKey: ["admin"] }); } }}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Stat label="المدة" value={p.duration_days ? `${p.duration_days} يوم` : "مدى الحياة"} />
              <Stat label="السعر" value={`${(p.price_cents / 100).toFixed(2)} ${p.currency}`} />
              <Stat label="الأجهزة" value={p.max_devices} />
              <Stat label="الجلسات" value={p.max_sessions} />
              <Stat label="البثوث المتزامنة" value={p.simultaneous_streams} />
              <Stat label="التحميل" value={p.allow_download ? "نعم" : "لا"} />
              <Stat label="التسجيل" value={p.allow_recording ? "نعم" : "لا"} />
              <Stat label="الحالة" value={p.is_active ? "مفعّلة" : "معطّلة"} />
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <PackageEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(v) => save.mutate(v)}
          busy={save.isPending}
          error={(save.error as any)?.message}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg bg-black/30 px-2.5 py-2 ring-1 ring-white/5">
      <p className="text-[10px] uppercase tracking-wider text-foreground/50">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

const input = "w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-primary";

function PackageEditor({ initial, onClose, onSave, busy, error }: any) {
  const [name, setName] = useState<string>(initial?.name ?? "");
  const [tier, setTier] = useState<string>(initial?.tier ?? "monthly");
  const [durationDays, setDurationDays] = useState<string>(initial?.duration_days?.toString() ?? "30");
  const [lifetime, setLifetime] = useState<boolean>(initial?.duration_days == null);
  const [maxDevices, setMaxDevices] = useState<number>(initial?.max_devices ?? 1);
  const [maxSessions, setMaxSessions] = useState<number>(initial?.max_sessions ?? 1);
  const [streams, setStreams] = useState<number>(initial?.simultaneous_streams ?? 1);
  const [allowDownload, setAllowDownload] = useState<boolean>(initial?.allow_download ?? false);
  const [allowRecording, setAllowRecording] = useState<boolean>(initial?.allow_recording ?? false);
  const [price, setPrice] = useState<string>(((initial?.price_cents ?? 0) / 100).toString());
  const [currency, setCurrency] = useState<string>(initial?.currency ?? "USD");
  const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState<number>(initial?.sort_order ?? 0);
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    onSave({
      id: initial?.id,
      name, tier,
      duration_days: lifetime ? null : Math.max(1, Number(durationDays) || 30),
      max_devices: maxDevices, max_sessions: maxSessions,
      simultaneous_streams: streams,
      allow_download: allowDownload, allow_recording: allowRecording,
      allowed_features: initial?.allowed_features ?? [],
      allowed_categories: initial?.allowed_categories ?? [],
      price_cents: Math.round(Number(price || "0") * 100),
      currency: currency.toUpperCase(),
      is_active: isActive, sort_order: sortOrder,
      notes: notes || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm px-4 py-8" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-2xl glass-strong rounded-3xl p-6 max-h-[90vh] overflow-y-auto space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">{initial ? "تعديل الباقة" : "باقة جديدة"}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الاسم"><input value={name} onChange={(e) => setName(e.target.value)} required className={input} /></Field>
          <Field label="الفئة">
            <select value={tier} onChange={(e) => setTier(e.target.value)} className={input}>
              {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="المدة (أيام)">
            <div className="flex items-center gap-2">
              <input type="number" min={1} disabled={lifetime} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className={input} />
              <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                <input type="checkbox" checked={lifetime} onChange={(e) => setLifetime(e.target.checked)} /> دائم
              </label>
            </div>
          </Field>
          <Field label="السعر"><input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={input} /></Field>
          <Field label="العملة"><input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} className={input} /></Field>
          <Field label="الترتيب"><input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={input} /></Field>
          <Field label="الحد الأقصى للأجهزة"><input type="number" min={1} value={maxDevices} onChange={(e) => setMaxDevices(Number(e.target.value))} className={input} /></Field>
          <Field label="الحد الأقصى للجلسات"><input type="number" min={1} value={maxSessions} onChange={(e) => setMaxSessions(Number(e.target.value))} className={input} /></Field>
          <Field label="البثوث المتزامنة"><input type="number" min={1} value={streams} onChange={(e) => setStreams(Number(e.target.value))} className={input} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Toggle label="السماح بالتحميل" checked={allowDownload} onChange={setAllowDownload} />
          <Toggle label="السماح بالتسجيل" checked={allowRecording} onChange={setAllowRecording} />
          <Toggle label="نشطة" checked={isActive} onChange={setIsActive} />
        </div>
        <Field label="ملاحظات"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={input} /></Field>
        {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-full bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-black text-white disabled:opacity-60">
          {busy ? "..." : "حفظ"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/70">{label}</span>
      {children}
    </label>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-xl bg-black/30 px-3 py-2.5 ring-1 ring-white/10 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm">{label}</span>
    </label>
  );
}
