import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { api } from "@/services/api";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { track } from "@/lib/analytics";
import type { Notification } from "@/services/api/types";

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    void api.notifications.list().then(setItems);
  }, []);

  const unread = items.filter((i) => i.unread).length;

  const markAll = () => {
    // Optimistic update; call the API in the background.
    setItems((xs) => xs.map((x) => ({ ...x, unread: false })));
    void api.notifications.markAllRead();
  };

  return (
    <GlassPanel className="w-[min(92vw,360px)] right-0 left-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-extrabold">
          الإشعارات{" "}
          {unread > 0 && (
            <span className="ms-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">{unread}</span>
          )}
        </h3>
        <button
          onClick={markAll}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-nav-active hover:text-nav-active/80"
        >
          <Check className="h-3.5 w-3.5" />
          تحديد الكل كمقروء
        </button>
      </div>
      <ul className="max-h-[60vh] overflow-y-auto py-1">
        {items.map((n) => (
          <li key={n.id}>
            <button
              onClick={() => track({ name: "notification_opened", id: n.id })}
              className="w-full flex items-start gap-3 px-4 py-3 text-right hover:bg-white/5"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.unread ? "bg-nav-active" : "bg-transparent"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`truncate text-sm ${n.unread ? "font-bold text-foreground" : "text-foreground/80"}`}
                  >
                    {n.title}
                  </p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{n.time}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/10 px-4 py-2 text-center">
        <button onClick={onClose} className="text-[11px] text-muted-foreground hover:text-foreground">
          إغلاق
        </button>
      </div>
    </GlassPanel>
  );
}
