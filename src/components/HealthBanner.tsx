/**
 * Health banner — polls the Xtream health endpoint and shows an Arabic
 * "server unavailable" notice at the top of the screen. Purely additive:
 * hidden when the backend is healthy.
 */
import { useEffect, useState } from "react";
import { api } from "@/services/api";

const POLL_MS = 30_000;

export function HealthBanner() {
  const [state, setState] = useState<{ ok: boolean; message?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let backoff = POLL_MS;

    async function tick() {
      try {
        const r = (await api.system?.health()) ?? { ok: true, message: undefined };
        if (cancelled) return;
        setState({ ok: r.ok, message: "message" in r ? r.message : undefined });
        backoff = r.ok ? POLL_MS : Math.min(120_000, backoff * 1.5);

      } catch {
        if (cancelled) return;
        setState({ ok: false, message: "تعذّر الاتصال بالخادم" });
        backoff = Math.min(120_000, backoff * 1.5);
      } finally {
        if (!cancelled) setTimeout(tick, backoff);
      }
    }
    tick();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state || state.ok) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[60] flex justify-center pointer-events-none px-3 pt-[max(env(safe-area-inset-top),0.5rem)]"
    >
      <div className="pointer-events-auto max-w-md w-full rounded-full bg-red-500/15 border border-red-400/30 backdrop-blur-md px-4 py-2 text-center text-xs text-red-100 shadow-lg">
        {state.message ?? "الخادم غير متاح حالياً"}
      </div>
    </div>
  );
}
