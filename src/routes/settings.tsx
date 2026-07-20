import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ChevronRight, LogOut, ShieldCheck, User } from "lucide-react";

import {
  getAccountInfo,
  signInWithOwnAccount,
  useDefaultAccount,
} from "@/lib/xtream.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — ليون تي في" },
      { name: "description", content: "أدر حسابك وتفضيلات التشغيل." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const accountFn = useServerFn(getAccountInfo);
  const signIn = useServerFn(signInWithOwnAccount);
  const useDefault = useServerFn(useDefaultAccount);

  const account = useQuery({
    queryKey: ["xtream", "account"],
    queryFn: () => accountFn(),
    staleTime: 30_000,
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: (v: { username: string; password: string; serverUrl?: string }) =>
      signIn({ data: v }),
    onSuccess: (res) => {
      if (!res.ok) {
        setError(res.error || "تعذّر تسجيل الدخول");
        return;
      }
      setError(null);
      setUsername("");
      setPassword("");
      setServerUrl("");
      queryClient.invalidateQueries();
    },
  });

  const switchDefault = useMutation({
    mutationFn: () => useDefault(),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    login.mutate({ username, password, serverUrl: serverUrl.trim() || undefined });
  }

  const isOverride = account.data?.isOverride ?? false;

  return (
    <div dir="rtl" className="mx-auto min-h-screen max-w-2xl px-4 py-8 pb-32 text-foreground">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to="/"
          className="grid h-9 w-9 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
          aria-label="رجوع"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-extrabold">الإعدادات</h1>
      </header>

      <section className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 backdrop-blur p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-foreground/70">الحساب الحالي</p>
            <p className="truncate text-base font-bold">
              {account.isLoading
                ? "..."
                : account.data?.username
                  ? account.data.username
                  : "غير متصل"}
            </p>
            <p className="text-[11px] text-foreground/60">
              {isOverride ? "حساب خاص بك" : "الحساب الافتراضي المشترك"}
              {account.data?.expiresAt
                ? ` · ينتهي في ${new Date(account.data.expiresAt).toLocaleDateString("ar")}`
                : ""}
            </p>
          </div>
        </div>

        {isOverride && (
          <button
            type="button"
            onClick={() => switchDefault.mutate()}
            disabled={switchDefault.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج والعودة إلى الحساب الافتراضي
          </button>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 backdrop-blur p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-nav-active" />
          <h2 className="text-lg font-bold">تسجيل الدخول بحسابك الخاص</h2>
        </div>
        <p className="mb-4 text-sm text-foreground/70">
          استخدم بيانات اشتراكك الخاص من مزوّد Xtream لعرض محتواك بدل الحساب الافتراضي.
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-foreground/70">اسم المستخدم</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm text-foreground ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-nav-active"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-foreground/70">كلمة المرور</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm text-foreground ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-nav-active"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-foreground/70">
              رابط الخادم (اختياري)
            </span>
            <input
              type="url"
              placeholder="http://server.example:8080"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm text-foreground ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-nav-active"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/20">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-full bg-nav-active px-4 py-3 text-sm font-extrabold text-black shadow transition hover:brightness-110 disabled:opacity-60"
          >
            {login.isPending ? "جارٍ الدخول..." : "تسجيل الدخول"}
          </button>
        </form>
      </section>

      <p className="mt-6 text-center text-[11px] text-foreground/50">
        بياناتك تُحفظ في جلسة مشفّرة على الخادم فقط، ولا تُرسل إلى أي طرف ثالث.
      </p>
    </div>
  );
}
