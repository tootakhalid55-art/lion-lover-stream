import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2, Sparkles } from "lucide-react";
import { Header } from "@/features/navigation/Header";
import { BottomNav } from "@/features/navigation/BottomNav";
import { PosterCard } from "@/features/catalog/PosterCard";
import { useFavorites, toggleFavorite } from "@/lib/user-data";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "قائمتي — LionTV" },
      { name: "description", content: "شاهد ما حفظته لاحقًا من الأفلام والمسلسلات على LionTV." },
      { property: "og:title", content: "قائمتي — LionTV" },
      { property: "og:description", content: "ملفك الشخصي: الأفلام والمسلسلات المحفوظة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FavoritesPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/favorites.tsx" functionName="FavoritesPage" lineNumber={14} />
  ),
});

function FavoritesPage() {
  const favs = useFavorites();
  return (
    <div className="min-h-dvh pb-32">
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pt-24">
        <div className="motion-safe:animate-fade-up">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-lime shadow-[0_0_12px_var(--lime)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime/90">مجموعتك</p>
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
            <span className="text-gradient-brand">قائمتي</span>
          </h1>
          <p className="mt-1 text-sm text-foreground/60">{favs.length} عنصر محفوظ</p>
        </div>

        {favs.length === 0 ? (
          <div className="mt-16 text-center motion-safe:animate-spring-in">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full glass">
              <Sparkles className="h-8 w-8 text-lime" />
            </div>
            <p className="mt-5 text-base font-bold text-foreground">قائمتك فارغة</p>
            <p className="mt-2 text-sm text-foreground/60">أضف الأفلام والمسلسلات التي تريد مشاهدتها لاحقًا.</p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-black text-neutral-900 shadow-[0_15px_40px_-10px_color-mix(in_oklab,var(--lime)_55%,transparent)] transition hover:scale-105"
            >
              تصفح المحتوى
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
            {favs.map((f, i) => (
              <li key={f.id} className="relative motion-safe:animate-fade-up" style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                <PosterCard poster={{ id: f.id, title: f.title, year: f.year, gradient: f.gradient, imageUrl: f.imageUrl, rating: f.rating }} rowId="favorites" />
                <button
                  onClick={() => toggleFavorite(f)}
                  aria-label="إزالة"
                  className="absolute -top-1 -left-1 grid h-8 w-8 place-items-center rounded-full glass-strong text-foreground hover:bg-red-500/80 hover:scale-110 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
