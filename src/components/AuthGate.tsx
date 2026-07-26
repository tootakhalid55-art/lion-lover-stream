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
const PUBLIC_PATHS = ["/login", "/bootstrap", "/redeem"];
const DEV_AUTH_BYPASS =
  import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === "true";

export function AuthGate() {
  const router = useRouter();
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const heartbeatFn = useServerFn(heartbeat);

  useEffect(() => {
    if (DEV_AUTH_BYPASS) {
      setReady(true);
      if (location.pathname === "/login" || location.pathname === "/bootstrap") {
        router.navigate({ to: "/", replace: true });
      }
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setReady(true);
      const path = location.pathname;
      if (!data.session && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
        router.navigate({ to: "/login", search: { redirect: path }, replace: true });
      }
      if (data.session && (path === "/login" || path === "/bootstrap")) {
        router.navigate({ to: "/", replace: true });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        router.navigate({ to: "/login", search: { redirect: "/" }, replace: true });
      }
      if (event === "SIGNED_IN" && session) {
        router.invalidate();
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [location.pathname, router]);

  // Heartbeat every 60s
  useEffect(() => {
    if (DEV_AUTH_BYPASS) return;

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
