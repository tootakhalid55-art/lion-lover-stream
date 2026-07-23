import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { finalizeLogin, resolveLoginEmail } from "@/lib/auth.functions";
import { getDeviceFingerprint } from "@/lib/auth-utils";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — Nova TV" },
      { name: "description", content: "سجّل الدخول إلى Nova TV باستخدام حسابك." },
      { property: "og:title", content: "تسجيل الدخول — Nova TV" },
      { property: "og:description", content: "بوابة الدخول الآمنة إلى Nova TV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ redirect: (s.redirect as string) || "/" }),
  component: LoginPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/login.tsx" functionName="LoginPage" lineNumber={30} />
  ),
});

function LoginPage() {
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const resolve = useServerFn(resolveLoginEmail);
  const finalize = useServerFn(finalizeLogin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const { email } = await resolve({ data: { username } });
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr) throw new Error("بيانات الدخول غير صحيحة");
      const fp = getDeviceFingerprint();
      await finalize({ data: fp });
      router.navigate({ to: redirect || "/", replace: true });
    } catch (e: any) {
      // Sign out to clear an invalid partial session
      await supabase.auth.signOut().catch(() => {});
      setError(e?.message || "تعذّر تسجيل الدخول");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-dvh flex items-center justify-center px-4 py-16 bg-[radial-gradient(ellipse_at_top,rgba(138,46,255,0.25),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(62,166,255,0.15),transparent_60%)]">
      <div className="w-full max-w-md glass-strong rounded-3xl p-8 shadow-2xl motion-safe:animate-fade-up">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/90">Nova TV</p>
            <h1 className="text-2xl font-black">تسجيل الدخول</h1>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/70">اسم المستخدم</span>
            <input
              type="text" autoComplete="username" required value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl bg-black/40 px-3 py-3 text-sm text-foreground ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/70">كلمة المرور</span>
            <input
              type="password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-black/40 px-3 py-3 text-sm text-foreground ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
              {error}
            </p>
          )}
          <button
            type="submit" disabled={busy || !username || !password}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.02] active:scale-95 disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {busy ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>
        <p className="mt-6 text-center text-[11px] text-foreground/50">
          الوصول مقيّد بحسابات مُنشأة من قِبل الإدارة فقط.
        </p>
      </div>
    </div>
  );
}
