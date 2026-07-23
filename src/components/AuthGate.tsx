import { useEffect, useState } from "react";
import { useRouter, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { heartbeat } from "@/lib/auth.functions";

/**
 * Client-side gate. Redirects unauthenticated users to /login for any
 * route except the public allow-list. Keeps existing app routes as-is
 * (no need to move them under `_authenticated/`).
 */
const PUBLIC_PATHS = ["/login", "/bootstrap"];

export function AuthGate() {
  const router = useRouter();
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const heartbeatFn = useServerFn(heartbeat);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setReady(true);
      const path = location.pathname;
      if (!data.session && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
        router.navigate({ to: "/login", search: { redirect: path } as any, replace: true });
      }
      if (data.session && (path === "/login" || path === "/bootstrap")) {
        router.navigate({ to: "/", replace: true });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        router.navigate({ to: "/login", replace: true });
      }
      if (event === "SIGNED_IN" && session) {
        router.invalidate();
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Heartbeat every 60s
  useEffect(() => {
    const tick = () =>
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) heartbeatFn().catch(() => {});
      });
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [heartbeatFn]);

  return null;
}
