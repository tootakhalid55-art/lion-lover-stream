import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Key, Lock } from "lucide-react";
import { bootstrapSuperAdmin, bootstrapStatus } from "@/lib/auth.functions";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/bootstrap")({
  head: () => ({
    meta: [
      { title: "تهيئة المسؤول — Nova TV" },
      { name: "description", content: "إنشاء أول حساب مسؤول لنظام Nova TV." },
      { property: "og:title", content: "تهيئة المسؤول — Nova TV" },
      { property: "og:description", content: "إعداد أول مسؤول لنظام Nova TV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  loader: async () => {
    try {
      return await bootstrapStatus();
    } catch {
      return { locked: true, hasSuperAdmin: true, codeConfigured: false };
    }
  },
  component: BootstrapPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/bootstrap.tsx" functionName="BootstrapPage" lineNumber={20} />
  ),
});

function BootstrapPage() {
  const router = useRouter();
  const status = Route.useLoaderData();
  const bootstrap = useServerFn(bootstrapSuperAdmin);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status.locked) {
      const t = setTimeout(() => router.navigate({ to: "/login" }), 3500);
      return () => clearTimeout(t);
    }
  }, [status.locked, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setBusy(true);
    try {
      await bootstrap({ data: { username, password, code } });
      setOk(true);
      setTimeout(() => router.navigate({ to: "/login" }), 1500);
    } catch (e: any) {
      setError(e?.message || "فشل الإنشاء");
    } finally { setBusy(false); }
  }

  if (status.locked) {
    return (
      <div dir="rtl" className="min-h-dvh flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md glass-strong rounded-3xl p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10">
            <Lock className="h-7 w-7 text-foreground/70" />
          </div>
          <h1 className="text-2xl font-black">التهيئة مقفولة</h1>
          <p className="mt-3 text-sm text-foreground/70">
            {status.hasSuperAdmin
              ? "تم إعداد المسؤول الرئيسي مسبقًا. لا يمكن استخدام هذه الصفحة مرة أخرى."
              : "رمز التهيئة غير مُهيّأ على الخادم."}
          </p>
          <Link to="/login" className="mt-6 inline-block rounded-full bg-white/10 px-5 py-2.5 text-sm font-bold ring-1 ring-white/15">
            الانتقال لتسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-dvh flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md glass-strong rounded-3xl p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
            <Key className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/90">Setup</p>
            <h1 className="text-2xl font-black">إنشاء أول مسؤول</h1>
          </div>
        </div>
        <p className="mb-4 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200 ring-1 ring-amber-500/30">
          هذه صفحة تهيئة لمرة واحدة. ستُقفل تلقائيًا بعد إنشاء المسؤول الرئيسي.
        </p>
        {ok ? (
          <p className="rounded-xl bg-lime-500/10 px-3 py-2 text-sm text-lime-300 ring-1 ring-lime-500/30">
            تم إنشاء الحساب. جارٍ التحويل إلى تسجيل الدخول...
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/70">اسم المستخدم</span>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username"
                className="w-full rounded-xl bg-black/40 px-3 py-3 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/70">كلمة المرور (8+)</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password"
                className="w-full rounded-xl bg-black/40 px-3 py-3 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-primary" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-foreground/70">رمز التهيئة</span>
              <input type="password" value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="one-time-code"
                className="w-full rounded-xl bg-black/40 px-3 py-3 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-primary" dir="ltr" />
              <span className="mt-1 block text-[11px] text-foreground/50">
                القيمة مخزّنة في المتغيّر السرّي <code>NOVA_ADMIN_BOOTSTRAP_CODE</code>.
              </span>
            </label>
            {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">{error}</p>}
            <button type="submit" disabled={busy}
              className="w-full rounded-full bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-black text-white disabled:opacity-60">
              {busy ? "..." : "إنشاء المسؤول الرئيسي"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

