import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings, Download, Bookmark, Info, HelpCircle } from "lucide-react";
import { Header } from "@/features/navigation/Header";
import { BottomNav } from "@/features/navigation/BottomNav";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/more")({
  head: () => ({ meta: [{ title: "المزيد — LionTV" }] }),
  component: MorePage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/more.tsx" functionName="MorePage" lineNumber={19} />
  ),
});

const LINKS = [
  { to: "/settings", label: "الإعدادات والحساب", icon: Settings },
  { to: "/favorites", label: "قائمتي", icon: Bookmark },
  { to: "/", label: "التنزيلات", icon: Download },
  { to: "/", label: "الدعم الفني", icon: HelpCircle },
  { to: "/", label: "حول التطبيق", icon: Info },
] as const;

function MorePage() {
  return (
    <div className="min-h-dvh bg-background pb-32">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pt-24">
        <h1 className="text-2xl font-black text-foreground">المزيد</h1>
        <ul className="mt-6 space-y-2">
          {LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <li key={l.label}>
                <Link
                  to={l.to}
                  className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-4 ring-1 ring-white/10 transition hover:bg-white/10"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-nav-active/15 text-nav-active">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1 text-sm font-bold text-foreground">{l.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
      <BottomNav />
    </div>
  );
}
