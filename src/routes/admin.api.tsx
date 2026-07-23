import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Copy, KeyRound, Play, Plus, RefreshCw, ShieldOff, Trash2, Webhook } from "lucide-react";
import { RouteError } from "@/components/RouteError";
import {
  apiUsageStats,
  createApiKey,
  createWebhookEndpoint,
  drainWebhookQueue,
  listApiKeys,
  listApiScopes,
  listWebhookDeliveries,
  listWebhookEndpoints,
  replayWebhookDelivery,
  revokeApiKey,
  toggleWebhookEndpoint,
} from "@/lib/api-keys.functions";
import { visibleOrgsForAdmin } from "@/lib/resellers.functions";

export const Route = createFileRoute("/admin/api")({
  head: () => ({
    meta: [
      { title: "REST API — Nova TV" },
      { name: "description", content: "إدارة مفاتيح API والويب هوكس ومركز إعادة الإرسال." },
      { property: "og:title", content: "REST API — Nova TV" },
      { property: "og:description", content: "مفاتيح API وويب هوكس." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ApiPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.api.tsx" functionName="ApiPage" lineNumber={20} />
  ),
});

function ApiPage() {
  const orgsFn = useServerFn(visibleOrgsForAdmin);
  const orgsQ = useQuery({ queryKey: ["orgs-visible"], queryFn: () => orgsFn(), staleTime: 60_000 });
  const [orgId, setOrgId] = useState<string | null>(null);
  const activeOrg = orgId ?? orgsQ.data?.orgs?.[0]?.id ?? null;

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">REST API · Webhooks</h1>
        <div className="flex items-center gap-2">
          <select
            value={activeOrg ?? ""}
            onChange={(e) => setOrgId(e.target.value)}
            className="rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-sm"
          >
            {(orgsQ.data?.orgs ?? []).map((o: any) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <a href="/api/v1/docs" target="_blank" className="rounded-full bg-white/5 px-4 py-1.5 text-sm hover:bg-white/10">
            Swagger UI
          </a>
          <a href="/api/v1/openapi" target="_blank" className="rounded-full bg-white/5 px-4 py-1.5 text-sm hover:bg-white/10">
            OpenAPI JSON
          </a>
        </div>
      </div>

      {activeOrg && <UsagePanel orgId={activeOrg} />}
      {activeOrg && <KeysPanel orgId={activeOrg} />}
      {activeOrg && <EndpointsPanel orgId={activeOrg} />}
      {activeOrg && <ReplayCenter orgId={activeOrg} />}
    </div>
  );
}

function UsagePanel({ orgId }: { orgId: string }) {
  const fn = useServerFn(apiUsageStats);
  const q = useQuery({ queryKey: ["api-usage", orgId], queryFn: () => fn({ data: { orgId, hours: 24 } }) });
  const s = q.data;
  return (
    <div className="glass-strong rounded-2xl p-5">
      <h2 className="text-lg font-black mb-3">استخدام API · آخر ٢٤ ساعة</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="طلبات" value={s?.total ?? 0} />
        <Kpi label="متوسط الاستجابة" value={`${s?.avgMs ?? 0}ms`} />
        <Kpi label="أخطاء 5xx" value={s?.errors ?? 0} tone="danger" />
        <Kpi label="Rate limit" value={s?.rateLimited ?? 0} tone="warn" />
        <Kpi label="فشل المصادقة" value={s?.authFail ?? 0} tone="warn" />
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "warn" | "danger" }) {
  const color = tone === "danger" ? "text-red-300" : tone === "warn" ? "text-amber-300" : "text-white";
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
      <p className="text-[11px] uppercase tracking-widest text-foreground/60">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function KeysPanel({ orgId }: { orgId: string }) {
  const listFn = useServerFn(listApiKeys);
  const createFn = useServerFn(createApiKey);
  const revokeFn = useServerFn(revokeApiKey);
  const scopesFn = useServerFn(listApiScopes);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["api-keys", orgId], queryFn: () => listFn({ data: { orgId } }) });
  const scopesQ = useQuery({ queryKey: ["api-scopes"], queryFn: () => scopesFn(), staleTime: 5 * 60_000 });
  const [openNew, setOpenNew] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  const revoke = useMutation({
    mutationFn: (keyId: string) => revokeFn({ data: { keyId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys", orgId] }),
  });

  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-black flex items-center gap-2"><KeyRound className="h-4 w-4" /> مفاتيح API</h2>
        <button onClick={() => { setIssued(null); setOpenNew(true); }} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> مفتاح جديد
        </button>
      </div>
      {issued && (
        <div className="mb-3 rounded-xl border border-lime-300/30 bg-lime-300/10 p-3 text-sm">
          <p className="mb-1 font-bold text-lime-200">احفظ المفتاح الآن — لن يُعرض مجددًا:</p>
          <code className="block break-all rounded bg-black/60 p-2 font-mono text-xs">{issued}</code>
          <button onClick={() => navigator.clipboard?.writeText(issued)} className="mt-2 inline-flex items-center gap-1 text-xs text-lime-200 hover:underline">
            <Copy className="h-3 w-3" /> نسخ
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase text-foreground/60">
            <tr><th className="p-2 text-right">الاسم</th><th className="p-2">Prefix</th><th className="p-2">Scopes</th><th className="p-2">آخر استخدام</th><th className="p-2">الحالة</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {(q.data?.keys ?? []).map((k: any) => (
              <tr key={k.id} className="border-t border-white/5">
                <td className="p-2">{k.name}</td>
                <td className="p-2 font-mono text-xs">nvk_{k.prefix}_…</td>
                <td className="p-2 text-xs text-foreground/70">{(k.scopes ?? []).join(", ")}</td>
                <td className="p-2 text-xs">{k.last_used_at ? new Date(k.last_used_at).toLocaleString("ar-EG") : "—"}</td>
                <td className="p-2 text-xs">{k.status === "active" ? "نشط" : "موقوف"}</td>
                <td className="p-2 text-left">
                  {k.status === "active" && (
                    <button onClick={() => revoke.mutate(k.id)} className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20">
                      <ShieldOff className="h-3 w-3" /> إبطال
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openNew && (
        <NewKeyDialog
          scopes={scopesQ.data?.scopes ?? []}
          onClose={() => setOpenNew(false)}
          onCreate={async (payload) => {
            const res = await createFn({ data: { orgId, ...payload } });
            setIssued(res.token);
            setOpenNew(false);
            qc.invalidateQueries({ queryKey: ["api-keys", orgId] });
          }}
        />
      )}
    </div>
  );
}

function NewKeyDialog({
  scopes, onClose, onCreate,
}: {
  scopes: readonly string[];
  onClose: () => void;
  onCreate: (p: { name: string; description?: string; scopes: string[]; allowedIps?: string[]; expiresAt?: string | null }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [ips, setIps] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="glass-strong w-full max-w-lg rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-3">مفتاح API جديد</h3>
        <div className="space-y-3 text-sm">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="الوصف (اختياري)" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2" />
          <div>
            <p className="mb-1 text-xs text-foreground/60">Scopes</p>
            <div className="max-h-40 overflow-auto rounded-lg border border-white/10 p-2 grid grid-cols-2 gap-1">
              {scopes.map((s) => (
                <label key={s} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={selected.includes(s)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, s] : prev.filter((x) => x !== s))} />
                  <span className="font-mono">{s}</span>
                </label>
              ))}
            </div>
          </div>
          <input value={ips} onChange={(e) => setIps(e.target.value)} placeholder="IPs المسموحة (فاصلة بينها) — اختياري" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 font-mono text-xs" />
          <input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2" />
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-full bg-white/5 px-4 py-1.5 text-sm">إلغاء</button>
          <button
            disabled={!name || selected.length === 0 || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onCreate({
                  name,
                  description: desc || undefined,
                  scopes: selected,
                  allowedIps: ips ? ips.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                  expiresAt: expiry ? new Date(expiry).toISOString() : null,
                });
              } finally { setBusy(false); }
            }}
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50"
          >
            إنشاء
          </button>
        </div>
      </div>
    </div>
  );
}

function EndpointsPanel({ orgId }: { orgId: string }) {
  const listFn = useServerFn(listWebhookEndpoints);
  const createFn = useServerFn(createWebhookEndpoint);
  const toggleFn = useServerFn(toggleWebhookEndpoint);
  const scopesFn = useServerFn(listApiScopes);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["wh-endpoints", orgId], queryFn: () => listFn({ data: { orgId } }) });
  const scopesQ = useQuery({ queryKey: ["api-scopes"], queryFn: () => scopesFn() });
  const [openNew, setOpenNew] = useState(false);
  const [issuedSecret, setIssuedSecret] = useState<string | null>(null);

  const toggle = useMutation({
    mutationFn: (v: { endpointId: string; active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wh-endpoints", orgId] }),
  });

  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-black flex items-center gap-2"><Webhook className="h-4 w-4" /> Webhooks</h2>
        <button onClick={() => { setIssuedSecret(null); setOpenNew(true); }} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> Endpoint جديد
        </button>
      </div>
      {issuedSecret && (
        <div className="mb-3 rounded-xl border border-lime-300/30 bg-lime-300/10 p-3 text-sm">
          <p className="mb-1 font-bold text-lime-200">Signing secret — احفظه الآن:</p>
          <code className="block break-all rounded bg-black/60 p-2 font-mono text-xs">{issuedSecret}</code>
        </div>
      )}
      <table className="min-w-full text-sm">
        <thead className="text-xs uppercase text-foreground/60">
          <tr><th className="p-2 text-right">URL</th><th className="p-2">Events</th><th className="p-2">الحالة</th><th className="p-2"></th></tr>
        </thead>
        <tbody>
          {(q.data?.endpoints ?? []).map((e: any) => (
            <tr key={e.id} className="border-t border-white/5">
              <td className="p-2 text-xs font-mono">{e.url}</td>
              <td className="p-2 text-xs text-foreground/70">{(e.events ?? []).join(", ")}</td>
              <td className="p-2 text-xs">{e.active ? "نشط" : "معطّل"}</td>
              <td className="p-2 text-left">
                <button onClick={() => toggle.mutate({ endpointId: e.id, active: !e.active })} className="rounded-full bg-white/5 px-3 py-1 text-xs hover:bg-white/10">
                  {e.active ? "تعطيل" : "تفعيل"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {openNew && (
        <NewEndpointDialog
          events={scopesQ.data?.events ?? []}
          onClose={() => setOpenNew(false)}
          onCreate={async (payload) => {
            const res = await createFn({ data: { orgId, ...payload } });
            setIssuedSecret(res.secret);
            setOpenNew(false);
            qc.invalidateQueries({ queryKey: ["wh-endpoints", orgId] });
          }}
        />
      )}
    </div>
  );
}

function NewEndpointDialog({
  events, onClose, onCreate,
}: {
  events: readonly string[];
  onClose: () => void;
  onCreate: (p: { url: string; description?: string; events: string[] }) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="glass-strong w-full max-w-lg rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-3">Webhook جديد</h3>
        <div className="space-y-3 text-sm">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 font-mono" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="الوصف (اختياري)" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2" />
          <div className="max-h-48 overflow-auto rounded-lg border border-white/10 p-2 grid grid-cols-2 gap-1">
            {events.map((e) => (
              <label key={e} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={selected.includes(e)} onChange={(ev) => setSelected((prev) => ev.target.checked ? [...prev, e] : prev.filter((x) => x !== e))} />
                <span className="font-mono">{e}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-full bg-white/5 px-4 py-1.5 text-sm">إلغاء</button>
          <button
            disabled={!url || selected.length === 0 || busy}
            onClick={async () => {
              setBusy(true);
              try { await onCreate({ url, description: desc || undefined, events: selected }); } finally { setBusy(false); }
            }}
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50"
          >
            إنشاء
          </button>
        </div>
      </div>
    </div>
  );
}

function ReplayCenter({ orgId }: { orgId: string }) {
  const listFn = useServerFn(listWebhookDeliveries);
  const replayFn = useServerFn(replayWebhookDelivery);
  const drainFn = useServerFn(drainWebhookQueue);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const [event, setEvent] = useState<string>("");
  const q = useQuery({
    queryKey: ["wh-deliveries", orgId, status, event],
    queryFn: () => listFn({ data: { orgId, status: status || null, event: event || null, limit: 100 } }),
  });
  const replay = useMutation({
    mutationFn: (deliveryId: string) => replayFn({ data: { deliveryId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wh-deliveries", orgId] }),
  });
  const drain = useMutation({
    mutationFn: () => drainFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wh-deliveries", orgId] }),
  });
  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-black">مركز إعادة الإرسال</h2>
        <div className="flex items-center gap-2 text-xs">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-full bg-white/5 border border-white/10 px-3 py-1">
            <option value="">كل الحالات</option>
            <option value="pending">قيد الإرسال</option>
            <option value="delivered">مُسلَّم</option>
            <option value="failed">فشل</option>
          </select>
          <input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="event" className="rounded-full bg-white/5 border border-white/10 px-3 py-1 font-mono" />
          <button onClick={() => drain.mutate()} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 hover:bg-white/10">
            <RefreshCw className="h-3 w-3" /> Drain
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="text-[10px] uppercase text-foreground/60">
            <tr>
              <th className="p-2 text-right">التاريخ</th>
              <th className="p-2">Event</th>
              <th className="p-2">Status</th>
              <th className="p-2">Attempt</th>
              <th className="p-2">HTTP</th>
              <th className="p-2">Correlation</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.deliveries ?? []).map((d: any) => (
              <tr key={d.id} className="border-t border-white/5">
                <td className="p-2">{new Date(d.created_at).toLocaleString("ar-EG")}</td>
                <td className="p-2 font-mono">{d.webhook_events?.kind}</td>
                <td className="p-2">
                  <span className={d.status === "delivered" ? "text-lime-300" : d.status === "failed" ? "text-red-300" : "text-amber-300"}>
                    {d.status}{d.dead && " · dead"}
                  </span>
                </td>
                <td className="p-2">{d.attempt}</td>
                <td className="p-2">{d.response_status ?? "—"}</td>
                <td className="p-2 font-mono text-[10px]">{d.correlation_id ?? "—"}</td>
                <td className="p-2 text-left">
                  <button onClick={() => replay.mutate(d.id)} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 hover:bg-white/10">
                    <Play className="h-3 w-3" /> Replay
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
