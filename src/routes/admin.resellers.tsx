import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Building2, Move, Plus, RefreshCcw, Wallet } from "lucide-react";
import { AdminHeader, EmptyState, Pill, fmt } from "@/components/admin/ui";
import { RouteError } from "@/components/RouteError";
import { createOrg, listOrgs, moveOrg, resellerTree, updateOrg } from "@/lib/resellers.functions";
import { walletAdjust, walletBalances } from "@/lib/wallet.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/resellers")({
  head: () => ({
    meta: [
      { title: "الموزّعون — Nova TV" },
      { name: "description", content: "إدارة تسلسل الموزّعين والمحافظ وحدود الائتمان." },
      { property: "og:title", content: "الموزّعون — Nova TV" },
      { property: "og:description", content: "شبكة موزّعي Nova TV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResellersPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.resellers.tsx" functionName="ResellersPage" lineNumber={20} />
  ),
});

type Org = { id: string; name: string; slug: string; type: string; parent_id: string | null; status: string; currency: string; country: string | null; created_at: string };
type Profile = { org_id: string; territory: string | null; credit_limit_cents: number; price_level: string; status: string; balance_cents: number };

const TYPES = [
  { v: "master_distributor", l: "موزّع رئيسي" },
  { v: "distributor", l: "موزّع" },
  { v: "reseller", l: "بائع" },
  { v: "sub_reseller", l: "بائع فرعي" },
  { v: "customer", l: "عميل" },
] as const;

function ResellersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOrgs);
  const treeFn = useServerFn(resellerTree);
  const createFn = useServerFn(createOrg);
  const updateFn = useServerFn(updateOrg);
  const moveFn = useServerFn(moveOrg);
  const balFn = useServerFn(walletBalances);
  const adjustFn = useServerFn(walletAdjust);

  const listQ = useQuery({ queryKey: ["admin", "orgs"], queryFn: () => listFn() });
  const treeQ = useQuery({ queryKey: ["admin", "reseller-tree"], queryFn: () => treeFn({ data: {} }) });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const orgs: Org[] = (treeQ.data?.orgs ?? listQ.data?.orgs ?? []) as any;
  const profiles: Profile[] = (treeQ.data?.profiles ?? []) as any;
  const selected = orgs.find((o) => o.id === selectedId) ?? null;
  const selectedProfile = profiles.find((p) => p.org_id === selectedId) ?? null;

  const balQ = useQuery({
    queryKey: ["admin", "wallet", selectedId],
    queryFn: () => balFn({ data: { orgId: selectedId! } }),
    enabled: !!selectedId,
  });

  const tree = useMemo(() => {
    const byParent = new Map<string | null, Org[]>();
    for (const o of orgs) {
      const arr = byParent.get(o.parent_id) ?? [];
      arr.push(o);
      byParent.set(o.parent_id, arr);
    }
    return byParent;
  }, [orgs]);

  const roots = tree.get(null) ?? orgs.filter((o) => !o.parent_id);

  const createM = useMutation({
    mutationFn: (v: any) => createFn({ data: v }),
    onSuccess: () => { toast.success("تم إنشاء المؤسسة"); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإنشاء"),
  });
  const updateM = useMutation({
    mutationFn: (v: any) => updateFn({ data: v }),
    onSuccess: () => { toast.success("تم التحديث"); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل التحديث"),
  });
  const moveM = useMutation({
    mutationFn: (v: any) => moveFn({ data: v }),
    onSuccess: () => { toast.success("تم نقل المؤسسة"); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل النقل"),
  });
  const adjustM = useMutation({
    mutationFn: (v: any) => adjustFn({ data: v }),
    onSuccess: () => { toast.success("تمّت الحركة"); qc.invalidateQueries({ queryKey: ["admin", "wallet", selectedId] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل"),
  });

  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", type: "reseller", parentId: "", currency: "USD", country: "", territory: "", creditLimitCents: 0 });

  return (
    <div className="space-y-6">
      <AdminHeader
        title="الموزّعون"
        subtitle="تسلسل هرمي كامل مع محافظ ائتمانية ومناطق وضرائب."
        actions={
          <>
            <button onClick={() => { treeQ.refetch(); listQ.refetch(); }} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
              <RefreshCcw className="h-4 w-4" /> تحديث
            </button>
            <button onClick={() => setNewOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white">
              <Plus className="h-4 w-4" /> مؤسسة جديدة
            </button>
          </>
        }
      />

      {newOpen && (
        <div className="glass-strong rounded-2xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3 text-sm">
          <input placeholder="الاسم" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} className="rounded-xl bg-white/5 px-3 py-2" />
          <select value={newForm.type} onChange={(e) => setNewForm({ ...newForm, type: e.target.value })} className="rounded-xl bg-white/5 px-3 py-2">
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <select value={newForm.parentId} onChange={(e) => setNewForm({ ...newForm, parentId: e.target.value })} className="rounded-xl bg-white/5 px-3 py-2 md:col-span-2">
            <option value="">— المؤسسة الأم —</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <input placeholder="العملة" value={newForm.currency} onChange={(e) => setNewForm({ ...newForm, currency: e.target.value.toUpperCase() })} className="rounded-xl bg-white/5 px-3 py-2" />
          <input placeholder="البلد" value={newForm.country} onChange={(e) => setNewForm({ ...newForm, country: e.target.value })} className="rounded-xl bg-white/5 px-3 py-2" />
          <input placeholder="المنطقة" value={newForm.territory} onChange={(e) => setNewForm({ ...newForm, territory: e.target.value })} className="rounded-xl bg-white/5 px-3 py-2 md:col-span-2" />
          <input type="number" placeholder="حد الائتمان (سنت)" value={newForm.creditLimitCents} onChange={(e) => setNewForm({ ...newForm, creditLimitCents: Number(e.target.value) })} className="rounded-xl bg-white/5 px-3 py-2 md:col-span-2" />
          <button
            disabled={!newForm.name || !newForm.parentId}
            onClick={() => createM.mutate(newForm)}
            className="rounded-xl bg-primary px-3 py-2 font-bold text-white disabled:opacity-50 md:col-span-2"
          >
            إنشاء
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3 text-sm text-foreground/70">
            <Building2 className="h-4 w-4" /> شجرة الموزّعين ({orgs.length})
          </div>
          {roots.length === 0 && <EmptyState>لا مؤسسات بعد.</EmptyState>}
          <ul className="space-y-1">
            {roots.map((o) => <OrgNode key={o.id} org={o} tree={tree} depth={0} selectedId={selectedId} onSelect={setSelectedId} />)}
          </ul>
        </div>

        <div className="glass rounded-2xl p-4 min-h-[300px]">
          {!selected ? (
            <EmptyState>اختر مؤسسة لعرض التفاصيل.</EmptyState>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black">{selected.name}</h3>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Pill tone="blue">{selected.type}</Pill>
                  <Pill tone={selected.status === "active" ? "green" : selected.status === "suspended" ? "yellow" : "red"}>{selected.status}</Pill>
                  <Pill tone="slate">{selected.currency}</Pill>
                  {selected.country && <Pill tone="slate">{selected.country}</Pill>}
                  {selectedProfile?.territory && <Pill tone="purple">{selectedProfile.territory}</Pill>}
                </div>
                <p className="mt-2 text-xs text-foreground/50">أنشئ في {fmt(selected.created_at)}</p>
              </div>

              <div className="rounded-xl bg-white/5 p-3 text-sm space-y-2">
                <div className="flex items-center gap-2 text-foreground/70"><Wallet className="h-4 w-4" /> المحفظة</div>
                {balQ.isLoading ? (
                  <p className="text-foreground/50">جارٍ التحميل…</p>
                ) : balQ.data ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Money label="السجلّ" cents={balQ.data.ledgerCents} currency={balQ.data.currency} />
                    <Money label="محجوز" cents={balQ.data.reservedCents} currency={balQ.data.currency} tone="yellow" />
                    <Money label="متاح" cents={balQ.data.availableCents} currency={balQ.data.currency} tone="green" />
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button onClick={() => {
                    const s = window.prompt("مبلغ الشحن (سنت)"); if (!s) return;
                    adjustM.mutate({ orgId: selected.id, deltaCents: Math.abs(Number(s)), kind: "topup", memo: "شحن يدوي" });
                  }} className="rounded-xl bg-emerald-500/20 text-emerald-200 px-3 py-2 text-xs font-bold">+ شحن</button>
                  <button onClick={() => {
                    const s = window.prompt("مبلغ التسوية (سنت، سالب للخصم)"); if (!s) return;
                    adjustM.mutate({ orgId: selected.id, deltaCents: Number(s), kind: "adjustment", memo: "تسوية يدوية" });
                  }} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold">تسوية</button>
                </div>
              </div>

              <div className="rounded-xl bg-white/5 p-3 text-sm space-y-2">
                <p className="text-foreground/70">حد الائتمان</p>
                <div className="flex gap-2">
                  <input
                    type="number" defaultValue={selectedProfile?.credit_limit_cents ?? 0}
                    onBlur={(e) => {
                      const v = Number(e.currentTarget.value);
                      if (Number.isFinite(v)) updateM.mutate({ orgId: selected.id, profile: { creditLimitCents: v } });
                    }}
                    className="w-full rounded-xl bg-white/5 px-3 py-2"
                  />
                  <span className="text-foreground/50 text-xs self-center">سنت</span>
                </div>
              </div>

              <div className="rounded-xl bg-white/5 p-3 text-sm space-y-2">
                <p className="text-foreground/70">الحالة</p>
                <div className="flex gap-2">
                  {(["active", "suspended", "disabled"] as const).map((s) => (
                    <button key={s} onClick={() => updateM.mutate({ orgId: selected.id, status: s })}
                      className={`rounded-full px-3 py-1.5 text-xs ${selected.status === s ? "bg-primary text-white" : "bg-white/5"}`}>{s}</button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-white/5 p-3 text-sm space-y-2">
                <div className="flex items-center gap-2 text-foreground/70"><Move className="h-4 w-4" /> نقل تحت مؤسسة أم</div>
                <select
                  defaultValue={selected.parent_id ?? ""}
                  onChange={(e) => {
                    if (!e.target.value || e.target.value === selected.parent_id) return;
                    const reason = window.prompt("سبب النقل (اختياري)") ?? undefined;
                    moveM.mutate({ orgId: selected.id, newParentId: e.target.value, reason });
                  }}
                  className="w-full rounded-xl bg-white/5 px-3 py-2"
                >
                  <option value="">— اختر —</option>
                  {orgs.filter((o) => o.id !== selected.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrgNode({ org, tree, depth, selectedId, onSelect }: { org: Org; tree: Map<string | null, Org[]>; depth: number; selectedId: string | null; onSelect: (id: string) => void }) {
  const kids = tree.get(org.id) ?? [];
  return (
    <li>
      <button
        onClick={() => onSelect(org.id)}
        className={`w-full text-right flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 ${selectedId === org.id ? "bg-white/10" : ""}`}
        style={{ paddingInlineStart: `${depth * 16 + 8}px` }}
      >
        <span className="text-xs text-foreground/50">{"›".repeat(depth + 1)}</span>
        <span className="text-sm font-medium">{org.name}</span>
        <Pill tone={org.type === "customer" ? "slate" : "blue"}>{org.type}</Pill>
        {org.status !== "active" && <Pill tone="yellow">{org.status}</Pill>}
      </button>
      {kids.length > 0 && (
        <ul className="mt-1 space-y-1">
          {kids.map((k) => <OrgNode key={k.id} org={k} tree={tree} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />)}
        </ul>
      )}
    </li>
  );
}

function Money({ label, cents, currency, tone = "slate" }: { label: string; cents: number; currency: string; tone?: "slate" | "green" | "yellow" }) {
  const color = tone === "green" ? "text-emerald-300" : tone === "yellow" ? "text-yellow-200" : "text-foreground";
  return (
    <div className="rounded-lg bg-black/20 px-2 py-2">
      <p className="text-[10px] text-foreground/50 uppercase">{label}</p>
      <p className={`text-sm font-black ${color}`}>{(cents / 100).toFixed(2)}</p>
      <p className="text-[10px] text-foreground/40">{currency}</p>
    </div>
  );
}
