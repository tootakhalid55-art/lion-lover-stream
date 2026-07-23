import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { listMyNotifications, markAllNotificationsRead, markNotificationRead, broadcastNotification } from "@/lib/notifications.functions";
import { useCapabilities } from "@/hooks/use-capabilities";
import { AdminHeader, EmptyState, Pill, fmt } from "@/components/admin/ui";
import { Bell, CheckCheck, Send } from "lucide-react";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/admin/notifications")({
  component: NotificationsPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.notifications.tsx" functionName="NotificationsPage" lineNumber={12} />
  ),
});

function NotificationsPage() {
  const caps = useCapabilities();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyNotifications);
  const markAllFn = useServerFn(markAllNotificationsRead);
  const markFn = useServerFn(markNotificationRead);
  const broadcastFn = useServerFn(broadcastNotification);

  const q = useQuery({ queryKey: ["notifications", "mine"], queryFn: () => listFn(), refetchInterval: 30_000 });
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<"info" | "warn" | "critical">("info");

  async function onMarkAll() { await markAllFn(); await qc.invalidateQueries({ queryKey: ["notifications"] }); }
  async function onMark(id: string) { await markFn({ data: { id } }); await qc.invalidateQueries({ queryKey: ["notifications"] }); }
  async function onBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await broadcastFn({ data: { title, body: body || undefined, severity } });
    setTitle(""); setBody(""); setSeverity("info");
    await qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="space-y-4">
      <AdminHeader title="الإشعارات" subtitle="صندوق الوارد وإرسال جماعي"
        actions={<button onClick={onMarkAll} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"><CheckCheck className="h-3.5 w-3.5" /> قراءة الكل</button>} />

      {caps.canBroadcast && (
        <form onSubmit={onBroadcast} className="glass-strong rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-primary"><Send className="h-4 w-4" /><span className="font-bold text-sm">إرسال جماعي</span></div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="العنوان" className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="النص (اختياري)" rows={2} className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none" />
          <div className="flex items-center gap-2">
            <select value={severity} onChange={(e) => setSeverity(e.target.value as any)} className="rounded-xl bg-white/5 px-3 py-1.5 text-sm">
              <option value="info">معلومة</option><option value="warn">تحذير</option><option value="critical">حرج</option>
            </select>
            <button type="submit" className="rounded-full bg-gradient-to-r from-primary to-accent px-4 py-1.5 text-sm font-bold text-white">إرسال</button>
          </div>
        </form>
      )}

      {q.isLoading ? <div className="text-foreground/50 p-8 text-center">جارٍ…</div>
        : !q.data?.length ? <EmptyState>لا إشعارات</EmptyState>
        : <div className="space-y-2">
          {q.data.map((n: any) => (
            <div key={n.id} className={`glass rounded-2xl p-4 flex items-start gap-3 ${!n.read_at ? "border-r-2 border-primary" : ""}`}>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/5"><Bell className="h-4 w-4" /></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <b>{n.title}</b>
                  <Pill tone={n.severity === "critical" ? "red" : n.severity === "warn" ? "yellow" : "slate"}>{n.severity}</Pill>
                  {!n.user_id && <Pill tone="purple">جماعي</Pill>}
                  <span className="text-[11px] text-foreground/50 ms-auto">{fmt(n.created_at)}</span>
                </div>
                {n.body && <p className="text-sm text-foreground/70 mt-1">{n.body}</p>}
              </div>
              {!n.read_at && <button onClick={() => onMark(n.id)} className="text-xs text-primary hover:underline">تحديد كمقروء</button>}
            </div>
          ))}
        </div>}
    </div>
  );
}
