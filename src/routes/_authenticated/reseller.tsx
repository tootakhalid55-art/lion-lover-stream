import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, LogOut, ShoppingCart, Wallet } from "lucide-react";
import { me } from "@/lib/auth.functions";
import { listOrgs } from "@/lib/resellers.functions";
import { resellerKpis } from "@/lib/reseller-dashboard.functions";
import { supabase } from "@/integrations/supabase/client";
import { RouteError } from "@/components/RouteError";
import { AdminHeader, Pill } from "@/components/admin/ui";

export const Route = createFileRoute("/_authenticated/reseller")({
  head: () => ({
    meta: [
      { title: "بوابة الموزّع — Nova TV" },
      { name: "description", content: "لوحة الموزّع: المبيعات، المحفظة، العملاء، والطلبات." },
      { property: "og:title", content: "بوابة الموزّع — Nova TV" },
      { property: "og:description", content: "أدوات إدارة الأعمال للموزّعين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResellerLayout,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/_authenticated/reseller.tsx" functionName="ResellerLayout" lineNumber={20} />
  ),
});

function ResellerLayout() {
  const meFn = useServerFn(me);
  const listFn = useServerFn(listOrgs);
  const kpisFn = useServerFn(resellerKpis);

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const orgsQ = useQuery({ queryKey: ["reseller", "orgs"], queryFn: () => listFn() });
  const firstOrgId = orgsQ.data?.orgs?.[0]?.id;
  const kpisQ = useQuery({
    queryKey: ["reseller", "kpis", firstOrgId],
    queryFn: () => kpisFn({ data: { orgId: firstOrgId! } }),
    enabled: !!firstOrgId,
  });

  if (meQ.isLoading) return <div dir="rtl" className="min-h-dvh grid place-items-center text-foreground/60">جارٍ التحميل…</div>;

  if (!orgsQ.data?.orgs?.length) {
    return (
      <div dir="rtl" className="min-h-dvh grid place-items-center px-4 bg-background text-foreground">
        <div className="glass-strong rounded-3xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-black mb-2">لا مؤسسة مرتبطة</h1>
          <p className="text-sm text-foreground/70 mb-6">تواصل مع المسؤول لربط حسابك بمؤسسة موزّع.</p>
          <Link to="/" className="inline-flex rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white">الرئيسية</Link>
        </div>
      </div>
    );
  }

  const k = kpisQ.data;
  const currency = k?.wallet.currency ?? "USD";
  const fmtMoney = (c: number) => `${(c / 100).toFixed(2)} ${currency}`;

  return (
    <div dir="rtl" className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white text-sm font-black">N</div>
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-widest text-primary/80">Nova TV</p>
              <p className="text-sm font-black">بوابة الموزّع</p>
            </div>
          </div>
          <div className="mr-auto flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-foreground/60">{meQ.data?.username}</span>
            <button onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/login"))} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">
              <LogOut className="h-3.5 w-3.5" /> خروج
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <AdminHeader
          title={`مرحبًا، ${meQ.data?.username ?? ""}`}
          subtitle={orgsQ.data.orgs[0].name}
          actions={<Pill tone="blue">{orgsQ.data.orgs[0].type}</Pill>}
        />

        {k && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={<Wallet className="h-4 w-4" />} label="المحفظة المتاحة" value={fmtMoney(k.wallet.availableCents)} />
              <Kpi icon={<BarChart3 className="h-4 w-4" />} label="إيرادات ٣٠ يوم" value={fmtMoney(k.revenue30dCents)} />
              <Kpi icon={<BarChart3 className="h-4 w-4" />} label="ربح ٣٠ يوم" value={fmtMoney(k.profit30dCents)} />
              <Kpi icon={<ShoppingCart className="h-4 w-4" />} label="طلبات معلّقة" value={String(k.outstandingOrders)} />
              <Kpi label="عملاء نشطون" value={String(k.activeCustomers)} />
              <Kpi label="رخص نشطة" value={String(k.activeLicenses)} />
              <Kpi label="تجديدات ٣٠ يوم" value={String(k.renewals30d)} />
              <Kpi label="تنتهي خلال ٧ أيام" value={String(k.expiring7d)} tone="yellow" />
            </div>
          </>
        )}

        <Outlet />
      </main>
    </div>
  );
}

function Kpi({ icon, label, value, tone = "slate" }: { icon?: React.ReactNode; label: string; value: string; tone?: "slate" | "yellow" }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs text-foreground/60">{icon}{label}</div>
      <p className={`mt-1 text-2xl font-black ${tone === "yellow" ? "text-yellow-200" : ""}`}>{value}</p>
    </div>
  );
}
