import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe2, Plus, ShieldCheck, Trash2, Zap } from "lucide-react";
import { AdminHeader, EmptyState, Pill, fmt } from "@/components/admin/ui";
import { useCapabilities } from "@/hooks/use-capabilities";
import { RouteError } from "@/components/RouteError";
import {
  addVpnNode,
  deleteVpnNode,
  listVpnEvents,
  listVpnNodes,
  testVpnNode,
  updateVpnNode,
} from "@/lib/vpn.functions";

export const Route = createFileRoute("/admin/vpn")({
  head: () => ({
    meta: [
      { title: "تجاوز الحجب — خوادم الخروج | Nova TV" },
      { name: "description", content: "إدارة خوادم الخروج التي يمر عبرها البث في Nova TV لتجاوز الحجب." },
      { property: "og:title", content: "تجاوز الحجب — خوادم الخروج | Nova TV" },
      { property: "og:description", content: "توجيه البث عبر خوادم خروج في دول مختلفة مع فحص الحالة وزمن الاستجابة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: VpnPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.vpn.tsx" functionName="VpnPage" lineNumber={32} />
  ),
});

const TONE: Record<string, "green" | "red" | "yellow" | "slate"> = {
  up: "green",
  degraded: "yellow",
  down: "red",
  unknown: "slate",
};

function VpnPage() {
  const caps = useCapabilities();
  const qc = useQueryClient();

  const listFn = useServerFn(listVpnNodes);
  const addFn = useServerFn(addVpnNode);
  const testFn = useServerFn(testVpnNode);
  const updateFn = useServerFn(updateVpnNode);
  const deleteFn = useServerFn(deleteVpnNode);
  const eventsFn = useServerFn(listVpnEvents);

  const nodes = useQuery({ queryKey: ["vpn-nodes"], queryFn: () => listFn(), refetchInterval: 30_000 });
  const events = useQuery({ queryKey: ["vpn-events"], queryFn: () => eventsFn(), refetchInterval: 30_000 });

  const [name, setName] = useState("");
  const [relayUrl, setRelayUrl] = useState("");
  const [relayToken, setRelayToken] = useState("");
  const [country, setCountry] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [priority, setPriority] = useState("100");
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["vpn-nodes"] });
    void qc.invalidateQueries({ queryKey: ["vpn-events"] });
  };

  const add = useMutation({
    mutationFn: async () => {
      setErr(null);
      setNote(null);
      return addFn({
        data: {
          name,
          relayUrl,
          relayToken,
          country: country || undefined,
          countryCode: countryCode || undefined,
          priority: Number(priority) || 100,
        },
      });
    },
    onSuccess: (r) => {
      setName("");
      setRelayUrl("");
      setRelayToken("");
      setCountry("");
      setCountryCode("");
      setNote(r.reachable ? `تمت الإضافة — عنوان الخروج ${r.ip ?? "غير معروف"}` : `أُضيف لكن الفحص فشل: ${r.error ?? "غير متاح"}`);
      invalidate();
    },
    onError: (e: unknown) => setErr(e instanceof Error ? e.message : String(e)),
  });

  const test = useMutation({
    mutationFn: (id: string) => testFn({ data: { id } }),
    onSuccess: (r) => {
      setNote(r.ok ? `الخادم يعمل — ${r.latencyMs}ms — IP ${r.ip ?? "?"}` : `فشل الفحص: ${r.error ?? "غير متاح"}`);
      invalidate();
    },
    onError: (e: unknown) => setErr(e instanceof Error ? e.message : String(e)),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => updateFn({ data: v }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: invalidate,
  });

  if (!caps.canManageSystem) {
    return <div className="glass rounded-2xl p-8 text-center text-foreground/60">صلاحيات غير كافية.</div>;
  }

  const list = nodes.data ?? [];
  const activeCount = list.filter((n) => n.enabled && n.status === "up").length;

  return (
    <div className="space-y-4">
      <AdminHeader
        title="تجاوز الحجب — خوادم الخروج"
        subtitle="يمر البث عبر خوادمك الخاصة، فلا يرى المزوّد عنوان المشاهد ولا يرى المشاهد عنوان المزوّد."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">التوجيه</p>
          <p className="mt-2 text-xl font-black">{activeCount ? "مُفعّل" : "معطّل"}</p>
          <Pill tone={activeCount ? "green" : "slate"}>{activeCount ? "يمر عبر خوادم الخروج" : "اتصال مباشر"}</Pill>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">إجمالي الخوادم</p>
          <p className="mt-2 text-2xl font-black">{list.length}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">خوادم تعمل</p>
          <p className="mt-2 text-2xl font-black">{activeCount}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">الدول المتاحة</p>
          <p className="mt-2 text-2xl font-black">
            {new Set(list.filter((n) => n.enabled).map((n) => n.country_code).filter(Boolean)).size}
          </p>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <h3 className="font-black mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4" /> إضافة خادم خروج
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم (مثال: ألمانيا 1)"
            className="rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10" />
          <input value={relayUrl} onChange={(e) => setRelayUrl(e.target.value)} placeholder="https://de1.example.com"
            className="rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 sm:col-span-2" dir="ltr" />
          <input value={relayToken} onChange={(e) => setRelayToken(e.target.value)} placeholder="رمز المصادقة (NOVA_RELAY_TOKEN)"
            type="password" className="rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 sm:col-span-2" dir="ltr" />
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="الدولة (ألمانيا)"
            className="rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10" />
          <input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} placeholder="رمز الدولة (DE)"
            maxLength={2} className="rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10" dir="ltr" />
          <input value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="الأولوية (أقل = أعلى)"
            className="rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10" />
          <button onClick={() => add.mutate()} disabled={add.isPending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {add.isPending ? "جارٍ الفحص…" : "إضافة وفحص"}
          </button>
        </div>
        {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
        {note && <p className="mt-2 text-xs text-emerald-300">{note}</p>}
        <p className="mt-3 text-xs leading-6 text-foreground/50">
          شغّل ملف <code className="mx-1">scripts/nova-relay.mjs</code> على كل خادم خروج:
          <code className="mx-1" dir="ltr">NOVA_RELAY_TOKEN=... PORT=8787 node nova-relay.mjs</code>
          ثم ضعه خلف Nginx مع شهادة TLS وسجّل الرابط هنا.
        </p>
      </div>

      <div className="glass rounded-2xl p-4">
        <h3 className="font-black mb-3 flex items-center gap-2">
          <Globe2 className="h-4 w-4" /> الخوادم
        </h3>
        {nodes.isLoading ? (
          <p className="text-sm text-foreground/50">جارٍ التحميل…</p>
        ) : !list.length ? (
          <EmptyState>لم تُضف خوادم خروج بعد — البث يمر مباشرة من الخادم الحالي.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-foreground/50">
                <tr>
                  <th className="py-2 text-start">الخادم</th>
                  <th className="py-2 text-start">الدولة</th>
                  <th className="py-2 text-start">الحالة</th>
                  <th className="py-2 text-start">الاستجابة</th>
                  <th className="py-2 text-start">آخر فحص</th>
                  <th className="py-2 text-start">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {list.map((n) => (
                  <tr key={n.id} className="border-t border-white/5">
                    <td className="py-2">
                      <div className="font-bold">{n.name}</div>
                      <div className="text-xs text-foreground/45" dir="ltr">{n.relay_url}</div>
                      {n.last_error && <div className="text-xs text-red-300">{n.last_error}</div>}
                    </td>
                    <td className="py-2">{n.country || n.country_code || "—"}</td>
                    <td className="py-2">
                      <Pill tone={n.enabled ? (TONE[n.status] ?? "slate") : "slate"}>
                        {!n.enabled ? "معطّل" : n.status === "up" ? "يعمل" : n.status === "degraded" ? "متذبذب" : n.status === "down" ? "متوقف" : "غير معروف"}
                      </Pill>
                    </td>
                    <td className="py-2">{n.latency_ms != null ? `${n.latency_ms}ms` : "—"}</td>
                    <td className="py-2 text-xs text-foreground/50">{fmt(n.last_checked_at)}</td>
                    <td className="py-2">
                      <div className="flex gap-1.5">
                        <button onClick={() => test.mutate(n.id)} disabled={test.isPending}
                          className="rounded-lg bg-white/5 p-1.5 hover:bg-white/10" title="فحص">
                          <Zap className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => toggle.mutate({ id: n.id, enabled: !n.enabled })}
                          className="rounded-lg bg-white/5 p-1.5 hover:bg-white/10" title={n.enabled ? "تعطيل" : "تفعيل"}>
                          <ShieldCheck className={`h-3.5 w-3.5 ${n.enabled ? "text-emerald-300" : "text-foreground/40"}`} />
                        </button>
                        <button onClick={() => remove.mutate(n.id)}
                          className="rounded-lg bg-white/5 p-1.5 hover:bg-red-500/20" title="حذف">
                          <Trash2 className="h-3.5 w-3.5 text-red-300" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-4">
        <h3 className="font-black mb-3">أحداث التوجيه</h3>
        {!events.data?.length ? (
          <EmptyState>لا توجد أحداث.</EmptyState>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {events.data.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 border-t border-white/5 py-1.5">
                <Pill tone={e.event_type.includes("failed") ? "red" : "green"}>{e.event_type}</Pill>
                <span className="text-foreground/70">{e.message ?? "—"}</span>
                {e.latency_ms != null && <span className="text-xs text-foreground/45">{e.latency_ms}ms</span>}
                <span className="mr-auto text-xs text-foreground/45">{fmt(e.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
