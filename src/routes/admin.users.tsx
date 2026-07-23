import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import {
  Copy, KeyRound, LogOut as LogOutIcon, MonitorSmartphone, Pencil,
  Plus, RefreshCw, Search, Trash2, X,
} from "lucide-react";
import {
  adminCreateUser, adminDeleteUser, adminForceLogout, adminListUsers,
  adminResetDevice, adminResetPassword, adminUpdateUser,
} from "@/lib/auth.functions";
import { listPackages } from "@/lib/licensing.functions";
import { DURATION_OPTIONS, STATUS_LABEL, type AccountStatus } from "@/lib/auth-utils";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/admin/users")({
  component: UsersAdmin,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.users.tsx" functionName="UsersAdmin" lineNumber={20} />
  ),
});

type Row = Awaited<ReturnType<typeof adminListUsers>>[number];

function copy(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function UsersAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListUsers);
  const createFn = useServerFn(adminCreateUser);
  const updateFn = useServerFn(adminUpdateUser);
  const deleteFn = useServerFn(adminDeleteUser);
  const resetPwFn = useServerFn(adminResetPassword);
  const resetDevFn = useServerFn(adminResetDevice);
  const forceOutFn = useServerFn(adminForceLogout);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AccountStatus | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [credential, setCredential] = useState<{ username: string; password: string } | null>(null);
  const [editRow, setEditRow] = useState<Row | null>(null);

  const list = useQuery({
    queryKey: ["admin", "users", search, status],
    queryFn: () => listFn({ data: { search, status } }),
    refetchInterval: 30_000,
    throwOnError: true,
  });

  const create = useMutation({
    mutationFn: (v: any) => createFn({ data: v }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      setCredential({ username: res.username, password: res.password });
      setShowCreate(false);
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin"] });

  const rows = list.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/90">Users</p>
          <h1 className="text-3xl font-black">إدارة المستخدمين</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => list.refetch()} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-2 text-xs hover:bg-white/10">
            <RefreshCw className={`h-3.5 w-3.5 ${list.isFetching ? "animate-spin" : ""}`} /> تحديث
          </button>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-bold text-white shadow-lg">
            <Plus className="h-4 w-4" /> حساب جديد
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث باسم المستخدم…"
            className="w-full rounded-full bg-black/40 pl-3 pr-9 py-2.5 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)}
          className="rounded-full bg-black/40 px-4 py-2.5 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="all">كل الحالات</option>
          {(["active","suspended","expired","disabled","locked"] as AccountStatus[]).map((s) =>
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <div className="glass-strong rounded-2xl overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-foreground/60">
            <tr>
              <th className="px-4 py-3">المستخدم</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">الانتهاء</th>
              <th className="px-4 py-3">الجهاز</th>
              <th className="px-4 py-3">آخر دخول</th>
              <th className="px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground/50">جارٍ التحميل…</td></tr>}
            {!list.isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground/50">لا توجد نتائج</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${r.online ? "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" : "bg-white/20"}`} />
                    <div>
                      <p className="font-bold">{r.username}</p>
                      <p className="text-xs text-foreground/50">{r.display_name || "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status as AccountStatus} />
                </td>
                <td className="px-4 py-3 text-xs text-foreground/70">
                  {r.expires_at ? new Date(r.expires_at).toLocaleDateString("ar") : "دائم"}
                </td>
                <td className="px-4 py-3 text-xs text-foreground/70">
                  {r.device ? `${r.device.os} · ${r.device.browser}` : <span className="text-foreground/40">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-foreground/70" dir="ltr">
                  {r.last_login_at ? new Date(r.last_login_at).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <IconBtn title="تعديل" onClick={() => setEditRow(r)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="إعادة تعيين كلمة المرور" onClick={async () => {
                      if (!confirm("إعادة تعيين كلمة المرور؟")) return;
                      const res: any = await resetPwFn({ data: { id: r.id } });
                      setCredential({ username: r.username, password: res.password });
                    }}><KeyRound className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="إعادة تعيين الجهاز" onClick={async () => {
                      if (!confirm("إلغاء ربط الجهاز الحالي؟")) return;
                      await resetDevFn({ data: { id: r.id } }); invalidate();
                    }}><MonitorSmartphone className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="تسجيل خروج قسري" onClick={async () => {
                      await forceOutFn({ data: { id: r.id } }); invalidate();
                    }}><LogOutIcon className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="حذف" onClick={async () => {
                      if (!confirm(`حذف الحساب ${r.username}؟`)) return;
                      await deleteFn({ data: { id: r.id } }); invalidate();
                    }} tone="danger"><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateModal
          busy={create.isPending}
          error={(create.error as any)?.message}
          onSubmit={(v) => create.mutate(v)}
          onClose={() => setShowCreate(false)}
        />
      )}
      {credential && (
        <CredentialModal
          username={credential.username} password={credential.password}
          onClose={() => setCredential(null)}
        />
      )}
      {editRow && (
        <EditModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSave={async (v) => { await updateFn({ data: { id: editRow.id, ...v } }); setEditRow(null); invalidate(); }}
        />
      )}
    </div>
  );
}

function IconBtn({ children, title, onClick, tone }: { children: any; title: string; onClick: () => void; tone?: "danger" }) {
  return (
    <button title={title} onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-lg ring-1 ring-white/10 transition ${tone === "danger" ? "bg-red-500/10 hover:bg-red-500/20 text-red-300" : "bg-white/5 hover:bg-white/10"}`}>
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const tone: Record<AccountStatus, string> = {
    active: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    suspended: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    expired: "bg-red-500/15 text-red-300 ring-red-500/30",
    disabled: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
    locked: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${tone[status]}`}>{STATUS_LABEL[status]}</span>;
}

function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm px-4 py-8" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg glass-strong rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">{title}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateModal({ onSubmit, onClose, busy, error }: { onSubmit: (v: any) => void; onClose: () => void; busy: boolean; error?: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [durationDays, setDurationDays] = useState<number | null>(30);
  const [notes, setNotes] = useState("");
  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      username: username || undefined, password: password || undefined,
      displayName: displayName || undefined, email, phone, durationDays, notes,
    });
  }
  return (
    <Modal title="إنشاء حساب جديد" onClose={onClose}>
      <form onSubmit={onFormSubmit} className="space-y-3">
        <Field label="اسم المستخدم (فارغ = تلقائي)">
          <input value={username} onChange={(e) => setUsername(e.target.value)} className={input} />
        </Field>
        <Field label="كلمة المرور (فارغ = تلقائي)">
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        </Field>
        <Field label="الاسم الظاهر">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={input} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="البريد (اختياري)"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></Field>
          <Field label="الهاتف (اختياري)"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={input} /></Field>
        </div>
        <Field label="مدة الاشتراك">
          <select value={durationDays === null ? "lifetime" : String(durationDays)}
            onChange={(e) => setDurationDays(e.target.value === "lifetime" ? null : Number(e.target.value))} className={input}>
            {DURATION_OPTIONS.map((o) => <option key={o.label} value={o.days === null ? "lifetime" : o.days}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="ملاحظات">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={input} />
        </Field>
        {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-full bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-black text-white disabled:opacity-60">
          {busy ? "..." : "إنشاء الحساب"}
        </button>
      </form>
    </Modal>
  );
}

function EditModal({ row, onClose, onSave }: { row: Row; onClose: () => void; onSave: (v: any) => void }) {
  const [displayName, setDisplayName] = useState(row.display_name || "");
  const [email, setEmail] = useState(row.email || "");
  const [phone, setPhone] = useState(row.phone || "");
  const [status, setStatus] = useState<AccountStatus>(row.status as AccountStatus);
  const [durationDays, setDurationDays] = useState<number | null | undefined>(undefined);
  const [notes, setNotes] = useState<string>((row as any).notes || "");
  return (
    <Modal title={`تعديل ${row.username}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ displayName, email, phone, status, durationDays, notes }); }} className="space-y-3">
        <Field label="الاسم الظاهر"><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={input} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="البريد"><input value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></Field>
          <Field label="الهاتف"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={input} /></Field>
        </div>
        <Field label="الحالة">
          <select value={status} onChange={(e) => setStatus(e.target.value as AccountStatus)} className={input}>
            {(["active","suspended","expired","disabled","locked"] as AccountStatus[]).map((s) =>
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="تمديد الاشتراك (اختياري)">
          <select value={durationDays === undefined ? "" : durationDays === null ? "lifetime" : String(durationDays)}
            onChange={(e) => {
              const v = e.target.value;
              setDurationDays(v === "" ? undefined : v === "lifetime" ? null : Number(v));
            }} className={input}>
            <option value="">— لا تغيير —</option>
            {DURATION_OPTIONS.map((o) => <option key={o.label} value={o.days === null ? "lifetime" : o.days}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="ملاحظات"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={input} /></Field>
        <button type="submit" className="w-full rounded-full bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-black text-white">حفظ</button>
      </form>
    </Modal>
  );
}

function CredentialModal({ username, password, onClose }: any) {
  return (
    <Modal title="بيانات الاعتماد" onClose={onClose}>
      <p className="mb-4 text-sm text-foreground/70">احفظ هذه البيانات الآن — لن تُعرض كلمة المرور مرة أخرى.</p>
      <div className="space-y-3">
        <CredRow label="اسم المستخدم" value={username} />
        <CredRow label="كلمة المرور" value={password} />
      </div>
    </Modal>
  );
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-black/40 p-3 ring-1 ring-white/10">
      <div className="min-w-0">
        <p className="text-[11px] uppercase text-foreground/50">{label}</p>
        <p dir="ltr" className="truncate font-mono text-sm">{value}</p>
      </div>
      <button onClick={() => copy(value)} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">
        <Copy className="h-3.5 w-3.5" /> نسخ
      </button>
    </div>
  );
}

const input = "w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-primary";
function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/70">{label}</span>
      {children}
    </label>
  );
}
