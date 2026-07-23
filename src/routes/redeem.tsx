import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { Copy, Ticket } from "lucide-react";
import { redeemActivationCode } from "@/lib/licensing.functions";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/redeem")({
  head: () => ({
    meta: [
      { title: "تفعيل رمز — Nova TV" },
      { name: "description", content: "استخدم رمز التفعيل لإنشاء حسابك في Nova TV." },
      { property: "og:title", content: "تفعيل رمز — Nova TV" },
      { property: "og:description", content: "أنشئ حسابك في ثوانٍ باستخدام رمز التفعيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RedeemPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/redeem.tsx" functionName="RedeemPage" lineNumber={20} />
  ),
});

function RedeemPage() {
  const redeem = useServerFn(redeemActivationCode);
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof redeemActivationCode>> | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null); setBusy(true);
    try {
      const r = await redeem({ data: { code, username, displayName, email, phone } });
      setResult(r);
    } catch (e: any) {
      setError(e?.message || "تعذّر تفعيل الرمز");
    } finally { setBusy(false); }
  }

  return (
    <div dir="rtl" className="min-h-dvh flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md glass-strong rounded-3xl p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/90">Nova TV</p>
            <h1 className="text-2xl font-black">تفعيل رمز</h1>
          </div>
        </div>
        {result ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 ring-1 ring-emerald-500/30">
              تم إنشاء حسابك بنجاح 🎉 احفظ البيانات التالية.
            </p>
            <CredRow label="اسم المستخدم" value={result.username} />
            <CredRow label="كلمة المرور" value={result.password} />
            <CredRow label="مفتاح الرخصة" value={result.licenseKey} />
            <div className="rounded-xl bg-black/40 p-3 text-sm ring-1 ring-white/10">
              <p className="text-[11px] uppercase text-foreground/50">الباقة</p>
              <p className="font-bold">{result.packageName}</p>
              {result.expiresAt && <p className="text-xs text-foreground/60">تنتهي {new Date(result.expiresAt).toLocaleDateString("ar")}</p>}
            </div>
            <a href="/login" className="block w-full rounded-full bg-gradient-to-r from-primary to-accent px-4 py-3 text-center text-sm font-black text-white">
              الذهاب لتسجيل الدخول
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Field label="رمز التفعيل">
              <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="NOVA-XXXX-XXXX-XXXX" dir="ltr"
                className="w-full rounded-xl bg-black/40 px-3 py-3 text-sm font-mono uppercase ring-1 ring-white/10 focus:ring-2 focus:ring-primary" />
            </Field>
            <Field label="اسم المستخدم (اختياري)">
              <input value={username} onChange={(e) => setUsername(e.target.value)} className={input} />
            </Field>
            <Field label="الاسم الظاهر (اختياري)">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={input} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="البريد (اختياري)"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} /></Field>
              <Field label="الهاتف (اختياري)"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={input} /></Field>
            </div>
            {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">{error}</p>}
            <button type="submit" disabled={busy || !code} className="w-full rounded-full bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-black text-white disabled:opacity-60">
              {busy ? "..." : "تفعيل"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
const input = "w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-primary";
function Field({ label, children }: any) {
  return <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-foreground/70">{label}</span>{children}</label>;
}
function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-black/40 p-3 ring-1 ring-white/10">
      <div className="min-w-0">
        <p className="text-[11px] uppercase text-foreground/50">{label}</p>
        <p dir="ltr" className="truncate font-mono text-sm">{value}</p>
      </div>
      <button onClick={() => navigator.clipboard?.writeText(value)} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">
        <Copy className="h-3.5 w-3.5" /> نسخ
      </button>
    </div>
  );
}
