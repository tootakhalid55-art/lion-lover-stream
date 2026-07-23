import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, LogOut, Users } from "lucide-react";
import { me } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — Nova TV" },
      { name: "description", content: "لوحة تحكم المسؤول لإدارة حسابات Nova TV." },
      { property: "og:title", content: "لوحة التحكم — Nova TV" },
      { property: "og:description", content: "إدارة المستخدمين والأجهزة والاشتراكات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminLayout,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/admin.tsx" functionName="AdminLayout" lineNumber={20} />
  ),
});

function AdminLayout() {
  const router = useRouter();
  const meFn = useServerFn(me);
  const q = useQuery({ queryKey: ["me"], queryFn: () => meFn(), staleTime: 30_000 });

  if (q.isLoading) {
    return <div dir="rtl" className="min-h-dvh grid place-items-center text-foreground/60">جارٍ التحقق…</div>;
  }
  if (!q.data || !q.data.isStaff) {
    return (
      <div dir="rtl" className="min-h-dvh grid place-items-center px-4">
        <div className="glass-strong rounded-3xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-black mb-2">لا صلاحيات كافية</h1>
          <p className="text-sm text-foreground/70 mb-6">هذه المنطقة مخصّصة للمسؤولين فقط.</p>
          <Link to="/" className="inline-flex rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white">العودة للرئيسية</Link>
        </div>
      </div>
    );
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/login", replace: true });
  }

  return (
    <div dir="rtl" className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-white text-sm font-black">N</div>
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-widest text-primary/80">Nova TV</p>
              <p className="text-sm font-black">لوحة التحكم</p>
            </div>
          </div>
          <nav className="mx-2 flex items-center gap-1 text-sm">
            <Link to="/admin" activeOptions={{ exact: true }} activeProps={{ className: "bg-white/10" }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:bg-white/5">
              <LayoutDashboard className="h-4 w-4" /> نظرة عامة
            </Link>
            <Link to="/admin/users" activeProps={{ className: "bg-white/10" }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:bg-white/5">
              <Users className="h-4 w-4" /> المستخدمون
            </Link>
          </nav>
          <div className="mr-auto flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-foreground/60">{q.data.username}</span>
            <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">
              <LogOut className="h-3.5 w-3.5" /> خروج
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
