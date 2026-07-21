import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings, Download, Bookmark, Info, HelpCircle, ChevronLeft } from "lucide-react";
import { Header } from "@/features/navigation/Header";
import { BottomNav } from "@/features/navigation/BottomNav";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/more")({
  head: () => ({
    meta: [
      { title: "المزيد — LionTV" },
      { name: "description", content: "الإعدادات، التنزيلات، والدعم على LionTV." },
      { property: "og:title", content: "المزيد — LionTV" },
      { property: "og:description", content: "إدارة الحساب والدعم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MorePage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/more.tsx" functionName="MorePage" lineNumber={19} />
  ),
});

const LINKS = [
  { to: "/settings", label: "الإعدادات والحساب", desc: "إدارة اشتراك Xtream", icon: Settings },
  { to: "/favorites", label: "قائمتي", desc: "الأفلام والمسلسلات المحفوظة", icon: Bookmark },
  { to: "/", label: "التنزيلات", desc: "المحتوى المتاح دون اتصال", icon: Download },
  { to: "/", label: "الدعم الفني", desc: "تواصل مع فريقنا", icon: HelpCircle },
  { to: "/", label: "حول التطبيق", desc: "الإصدار والترخيص", icon: Info },
] as const;

function MorePage() {
  return (
    <div className="min-h-dvh pb-32">
      <Header />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 pt-24">
        <div className="motion-safe:animate-fade-up">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-lime shadow-[0_0_12px_var(--lime)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime/90">القائمة</p>
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
            <span className="text-gradient-brand">المزيد</span>
          </h1>
        </div>
        <ul className="mt-8 space-y-2.5">
          {LINKS.map((l, i) => {
            const Icon = l.icon;
            return (
              <li key={l.label} className="motion-safe:animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <Link
                  to={l.to}
                  className="group flex items-center gap-4 rounded-2xl glass px-4 py-4 transition-all hover:bg-white/10 hover:-translate-y-0.5 hover:ring-lime/30"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lime/25 to-brand/25 text-lime ring-1 ring-white/10">
                    <Icon className="h-5 w-5" strokeWidth={2.4} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{l.label}</p>
                    <p className="mt-0.5 truncate text-[11px] text-foreground/60">{l.desc}</p>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-foreground/40 transition-transform group-hover:-translate-x-1 group-hover:text-lime" />
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
