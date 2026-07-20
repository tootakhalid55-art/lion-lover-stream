import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { Header } from "@/features/navigation/Header";
import { BottomNav } from "@/features/navigation/BottomNav";
import { PosterCard } from "@/features/catalog/PosterCard";
import { useFavorites, toggleFavorite } from "@/lib/user-data";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "قائمتي — LionTV" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const favs = useFavorites();
  return (
    <div className="min-h-dvh bg-background pb-32">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pt-24">
        <h1 className="text-2xl font-black text-foreground">قائمتي</h1>
        {favs.length === 0 ? (
          <p className="mt-8 text-center text-sm text-foreground/60">
            قائمتك فارغة. أضف عناصر من صفحات الأفلام والمسلسلات.
            <br />
            <Link to="/" className="mt-4 inline-block text-nav-active hover:underline">تصفح المحتوى</Link>
          </p>
        ) : (
          <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {favs.map((f) => (
              <li key={f.id} className="relative">
                <PosterCard poster={{ id: f.id, title: f.title, year: f.year, gradient: f.gradient, imageUrl: f.imageUrl, rating: f.rating }} rowId="favorites" />
                <button
                  onClick={() => toggleFavorite(f)}
                  aria-label="إزالة"
                  className="absolute -top-1 -left-1 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-foreground ring-1 ring-white/20 hover:bg-red-500/80"
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
