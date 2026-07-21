import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ChevronRight, LogOut, ShieldCheck, User } from "lucide-react";
import { Header } from "@/features/navigation/Header";
import { BottomNav } from "@/features/navigation/BottomNav";
import { getAccountInfo, signInWithOwnAccount, useDefaultAccount } from "@/lib/xtream.functions";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — LionTV" },
      { name: "description", content: "أدر حسابك وتفضيلات التشغيل على LionTV." },
      { property: "og:title", content: "الإعدادات — LionTV" },
      { property: "og:description", content: "إدارة اشتراك Xtream وتفضيلات التشغيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/settings.tsx" functionName="SettingsPage" lineNumber={29} />
  ),
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const accountFn = useServerFn(getAccountInfo);
  const signIn = useServerFn(signInWithOwnAccount);
  const useDefault = useServerFn(useDefaultAccount);

  const account = useQuery({ queryKey: ["xtream", "account"], queryFn: () => accountFn(), staleTime: 30_000, throwOnError: true });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: (v: { username: string; password: string; serverUrl?: string }) => signIn({ data: v }),
    onSuccess: (res) => {
      if (!res.ok) { setError(res.error || "تعذّر تسجيل الدخول"); return; }
      setError(null); setUsername(""); setPassword(""); setServerUrl("");
      queryClient.invalidateQueries();
    },
  });

  const switchDefault = useMutation({ mutationFn: () => useDefault(), onSuccess: () => queryClient.invalidateQueries() });

  function onSubmit(e: FormEvent) {
    e.preventDefault(); setError(null);
    login.mutate({ username, password, serverUrl: serverUrl.trim() || undefined });
  }

  const isOverride = account.data?.isOverride ?? false;

  return (
    <div dir="rtl" className="min-h-dvh pb-32 text-foreground">
      <Header />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 pt-24">
        <div className="flex items-center gap-3 motion-safe:animate-fade-up">
          <Link to="/" className="grid h-10 w-10 place-items-center rounded-full glass hover:bg-white/15 transition" aria-label="رجوع">
            <ChevronRight className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime/90">حسابك</p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              <span className="text-gradient-brand">الإعدادات</span>
            </h1>
          </div>
        </div>

        <section className="mt-8 glass-strong rounded-3xl p-5 motion-safe:animate-fade-up">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand to-fuchsia-700 text-white ring-1 ring-white/15 shadow-lg">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">الحساب الحالي</p>
              <p className="truncate text-base font-black">
                {account.isLoading ? "..." : account.data?.username ? account.data.username : "غير متصل"}
              </p>
              <p className="text-[11px] text-foreground/60">
                {isOverride ? "حساب خاص بك" : "الحساب الافتراضي المشترك"}
                {account.data?.expiresAt ? ` · ينتهي في ${new Date(account.data.expiresAt).toLocaleDateString("ar")}` : ""}
              </p>
            </div>
          </div>
          {isOverride && (
            <button
              type="button"
              onClick={() => switchDefault.mutate()}
              disabled={switchDefault.isPending}
              className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-bold hover:bg-white/15 disabled:opacity-50 transition"
            >
              <LogOut className="h-4 w-4" />
              العودة إلى الحساب الافتراضي
            </button>
          )}
        </section>

        <section className="mt-6 glass-strong rounded-3xl p-5 motion-safe:animate-fade-up" style={{ animationDelay: "80ms" }}>
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-lime" />
            <h2 className="text-lg font-black">تسجيل الدخول بحسابك الخاص</h2>
          </div>
          <p className="mb-4 text-sm text-foreground/70">
            استخدم بيانات اشتراكك من مزوّد Xtream لعرض محتواك بدل الحساب الافتراضي.
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/70">اسم المستخدم</span>
              <input
                type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required
                className="w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm text-foreground ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-lime transition"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/70">كلمة المرور</span>
              <input
                type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm text-foreground ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-lime transition"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/70">رابط الخادم (اختياري)</span>
              <input
                type="url" placeholder="http://server.example:8080" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)}
                className="w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm text-foreground ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-lime transition"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
                {error}
              </p>
            )}
            <button
              type="submit" disabled={login.isPending}
              className="w-full rounded-full bg-lime px-4 py-3 text-sm font-black text-neutral-900 shadow-[0_15px_40px_-10px_color-mix(in_oklab,var(--lime)_55%,transparent)] transition hover:scale-[1.02] active:scale-95 disabled:opacity-60"
            >
              {login.isPending ? "جارٍ الدخول..." : "تسجيل الدخول"}
            </button>
          </form>
        </section>

        <p className="mt-6 text-center text-[11px] text-foreground/50">
          بياناتك تُحفظ في جلسة مشفّرة على الخادم فقط، ولا تُرسل إلى أي طرف ثالث.
        </p>
      </main>
      <BottomNav />
    </div>
  );
}
