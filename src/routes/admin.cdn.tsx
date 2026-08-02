import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudCog, Film, Plus, RefreshCw, Radio, Trash2 } from "lucide-react";
import { AdminHeader, EmptyState, Pill, fmt } from "@/components/admin/ui";
import { useCapabilities } from "@/hooks/use-capabilities";
import { RouteError } from "@/components/RouteError";
import {
  cfStatus,
  deleteCfAsset,
  ingestCfVod,
  listCfAssets,
  listCfEvents,
  provisionCfLive,
  refreshCfAsset,
  setCfAssetEnabled,
} from "@/lib/cloudflare-stream.functions";

export const Route = createFileRoute("/admin/cdn")({
  head: () => ({
    meta: [
      { title: "شبكة التوزيع Cloudflare — Nova TV" },
      { name: "description", content: "إدارة توزيع البث عبر Cloudflare Stream في Nova TV." },
      { property: "og:title", content: "شبكة التوزيع Cloudflare — Nova TV" },
      { property: "og:description", content: "إدارة القنوات المباشرة والأفلام الموزّعة عبر Cloudflare Stream." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CdnPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.cdn.tsx" functionName="CdnPage" lineNumber={34} />
  ),
});

const STATUS_TONE: Record<string, "green" | "red" | "yellow" | "slate"> = {
  ready: "green",
  live: "green",
  provisioning: "yellow",
  pending: "yellow",
  idle: "slate",
  errored: "red",
  disabled: "slate",
};

function CdnPage() {
  const caps = useCapabilities();
  const qc = useQueryClient();

  const statusFn = useServerFn(cfStatus);
  const listFn = useServerFn(listCfAssets);
  const eventsFn = useServerFn(listCfEvents);
  const provisionFn = useServerFn(provisionCfLive);
  const ingestFn = useServerFn(ingestCfVod);
  const refreshFn = useServerFn(refreshCfAsset);
  const toggleFn = useServerFn(setCfAssetEnabled);
  const removeFn = useServerFn(deleteCfAsset);

  const status = useQuery({ queryKey: ["cf-status"], queryFn: () => statusFn(), refetchInterval: 30_000 });
  const assets = useQuery({ queryKey: ["cf-assets"], queryFn: () => listFn(), refetchInterval: 30_000 });
  const events = useQuery({ queryKey: ["cf-events"], queryFn: () => eventsFn(), refetchInterval: 30_000 });

  const [kind, setKind] = useState<"live" | "movie" | "series">("live");
  const [xtreamId, setXtreamId] = useState("");
  const [title, setTitle] = useState("");
  const [ext, setExt] = useState("mp4");
  const [err, setErr] = useState<string | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["cf-assets"] });
    void qc.invalidateQueries({ queryKey: ["cf-status"] });
    void qc.invalidateQueries({ queryKey: ["cf-events"] });
  };

  const add = useMutation({
    mutationFn: async () => {
      setErr(null);
      if (!xtreamId.trim()) throw new Error("أدخل معرّف Xtream");
      if (kind === "live") return provisionFn({ data: { xtreamId: xtreamId.trim(), title: title.trim() || undefined } });
      return ingestFn({ data: { kind, xtreamId: xtreamId.trim(), title: title.trim() || undefined, ext } });
    },
    onSuccess: () => {
      setXtreamId("");
      setTitle("");
      invalidate();
    },
    onError: (e: unknown) => setErr(e instanceof Error ? e.message : String(e)),
  });

  const refresh = useMutation({
    mutationFn: (id: string) => refreshFn({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: unknown) => setErr(e instanceof Error ? e.message : String(e)),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => toggleFn({ data: v }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: invalidate,
  });

  if (!caps.canManageSystem) {
    return <div className="glass rounded-2xl p-8 text-center text-foreground/60">صلاحيات غير كافية.</div>;
  }

  const s = status.data;

  return (
    <div className="space-y-4">
      <AdminHeader
        title="شبكة التوزيع — Cloudflare Stream"
        subtitle="توزيع الأفلام والقنوات عبر شبكة Cloudflare العالمية بدل البث المباشر من المزوّد."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">الاتصال</p>
          <p className="mt-2 text-xl font-black">{s?.configured ? "مُهيّأ" : "غير مُهيّأ"}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Pill tone={s?.configured ? "green" : "red"}>API</Pill>
            <Pill tone={s?.webhookConfigured ? "green" : "yellow"}>Webhook</Pill>
            <Pill tone={s?.restreamerConfigured ? "green" : "yellow"}>Restreamer</Pill>
          </div>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">إجمالي الأصول</p>
          <p className="mt-2 text-2xl font-black">{s?.total ?? "…"}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">جاهزة / مباشرة</p>
          <p className="mt-2 text-2xl font-black">{(s?.byStatus?.["ready"] ?? 0) + (s?.byStatus?.["live"] ?? 0)}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">عُقد إعادة البث</p>
          <p className="mt-2 text-2xl font-black">{s?.nodes?.length ?? 0}</p>
          <p className="text-xs text-foreground/50 mt-1">
            {s?.nodes?.[0] ? `آخر نبضة ${fmt(s.nodes[0].last_heartbeat_at)}` : "لا توجد عُقد متصلة"}
          </p>
        </div>
      </div>

      {!s?.configured && (
        <div className="rounded-2xl bg-yellow-500/10 p-4 text-sm text-yellow-200 ring-1 ring-yellow-500/30">
          أضف مفاتيح Cloudflare (<code>CLOUDFLARE_ACCOUNT_ID</code> و <code>CLOUDFLARE_STREAM_API_TOKEN</code>) لتفعيل التوزيع.
        </div>
      )}

      <div className="glass rounded-2xl p-4">
        <h3 className="font-black mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4" /> إضافة أصل جديد
        </h3>
        <div className="grid gap-2 sm:grid-cols-5">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10"
          >
            <option value="live">قناة مباشرة</option>
            <option value="movie">فيلم</option>
            <option value="series">حلقة مسلسل</option>
          </select>
          <input
            value={xtreamId}
            onChange={(e) => setXtreamId(e.target.value)}
            placeholder="معرّف Xtream"
            className="rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="العنوان (اختياري)"
            className="rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 sm:col-span-2"
          />
          {kind === "live" ? (
            <button
              onClick={() => add.mutate()}
              disabled={add.isPending}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {add.isPending ? "جارٍ…" : "تجهيز إدخال مباشر"}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                value={ext}
                onChange={(e) => setExt(e.target.value)}
                placeholder="mp4"
                className="w-20 rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10"
              />
              <button
                onClick={() => add.mutate()}
                disabled={add.isPending}
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {add.isPending ? "جارٍ…" : "رفع إلى Cloudflare"}
              </button>
            </div>
          )}
        </div>
        {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
        <p className="mt-2 text-xs text-foreground/50">
          القنوات المباشرة تحتاج عامل إعادة بث (ffmpeg) على الخادم يسحب القائمة من
          <code className="mx-1">/api/public/cf-stream/restreamer</code> ويدفعها عبر RTMPS.
        </p>
      </div>

      <div className="glass rounded-2xl p-4">
        <h3 className="font-black mb-3 flex items-center gap-2">
          <CloudCog className="h-4 w-4" /> الأصول
        </h3>
        {assets.isLoading ? (
          <p className="text-sm text-foreground/50">جارٍ التحميل…</p>
        ) : !assets.data?.length ? (
          <EmptyState>لا توجد أصول موزّعة بعد.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-foreground/50">
                <tr>
                  <th className="py-2 text-start">النوع</th>
                  <th className="py-2 text-start">المعرّف / العنوان</th>
                  <th className="py-2 text-start">الحالة</th>
                  <th className="py-2 text-start">آخر تحديث</th>
                  <th className="py-2 text-start">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {assets.data.map((a) => (
                  <tr key={a.id} className="border-t border-white/5">
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1.5">
                        {a.kind === "live" ? <Radio className="h-3.5 w-3.5 text-primary" /> : <Film className="h-3.5 w-3.5 text-primary" />}
                        {a.kind === "live" ? "مباشر" : a.kind === "movie" ? "فيلم" : "حلقة"}
                      </span>
                    </td>
                    <td className="py-2">
                      <p className="font-semibold">{a.title || a.xtream_id}</p>
                      <p className="text-[11px] text-foreground/50">{a.xtream_id}</p>
                    </td>
                    <td className="py-2">
                      <Pill tone={STATUS_TONE[a.status] ?? "slate"}>{a.status}</Pill>
                      {!a.enabled && <span className="ms-1 text-[11px] text-foreground/50">معطّل</span>}
                      {a.error_message && <p className="text-[11px] text-red-300 mt-1">{a.error_message}</p>}
                    </td>
                    <td className="py-2 text-[11px] text-foreground/50">{fmt(a.last_seen_at ?? a.updated_at)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => refresh.mutate(a.id)}
                          title="تحديث الحالة"
                          className="rounded-lg bg-white/5 p-1.5 hover:bg-white/10"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggle.mutate({ id: a.id, enabled: !a.enabled })}
                          className="rounded-lg bg-white/5 px-2 py-1 text-[11px] hover:bg-white/10"
                        >
                          {a.enabled ? "تعطيل" : "تفعيل"}
                        </button>
                        <button
                          onClick={() => remove.mutate(a.id)}
                          title="حذف"
                          className="rounded-lg bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
        <h3 className="font-black mb-3">آخر الأحداث</h3>
        {!events.data?.length ? (
          <p className="text-sm text-foreground/50">لا توجد أحداث.</p>
        ) : (
          <div className="space-y-1.5">
            {events.data.map((e) => (
              <div key={e.id} className="flex items-center justify-between border-t border-white/5 pt-1.5 first:border-t-0 first:pt-0 text-sm">
                <span>
                  <span className="font-semibold">{e.event_type}</span>
                  {e.message && <span className="text-foreground/60"> — {e.message}</span>}
                </span>
                <span className="text-[11px] text-foreground/50">{fmt(e.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
