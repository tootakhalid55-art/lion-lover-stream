import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search as SearchIcon, ArrowRight, X } from "lucide-react";
import { api } from "@/services/api";
import { Header } from "@/features/navigation/Header";
import { BottomNav } from "@/features/navigation/BottomNav";
import { PosterCard } from "@/features/catalog/PosterCard";
import type { Poster } from "@/services/api/types";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "البحث — LionTV" },
      { name: "description", content: "ابحث عن الأفلام والمسلسلات والقنوات في LionTV." },
      { property: "og:title", content: "البحث — LionTV" },
      { property: "og:description", content: "اكتشف كل ما تريد مشاهدته." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SearchPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/search.tsx" functionName="SearchPage" lineNumber={22} />
  ),
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Poster[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    setLoadError(null);
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    void api.search.suggest(q, "all")
      .then((r) => { if (alive) { setResults(r); setLoading(false); } })
      .catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("[runtime:exception]", { filename: "src/routes/search.tsx", functionName: "SearchPage.useEffect:searchAll", lineNumber: 28, message: error.message, stack: error.stack ?? null, requestUrl: window.location.href, httpStatus: null });
        if (alive) { setLoading(false); setLoadError(error); }
      });
    return () => { alive = false; };
  }, [q]);

  if (loadError) return <RouteError error={loadError} filename="src/routes/search.tsx" functionName="SearchPage.useEffect:searchAll" lineNumber={28} />;

  return (
    <div className="min-h-dvh pb-32">
      <Header />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 pt-24">
        <div className="motion-safe:animate-fade-up">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-lime shadow-[0_0_12px_var(--lime)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime/90">اكتشف</p>
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
            ماذا <span className="text-gradient-brand">تبحث</span> عنه؟
          </h1>
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-2xl glass-strong px-4 py-3 focus-within:ring-lime/60 transition motion-safe:animate-fade-up">
          <SearchIcon className="h-5 w-5 text-lime/80" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث في أفلام، مسلسلات، قنوات…"
            className="flex-1 bg-transparent text-base text-foreground placeholder:text-foreground/40 focus:outline-none"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              aria-label="مسح"
              className="grid h-8 w-8 place-items-center rounded-full text-foreground/70 hover:bg-white/10 hover:text-foreground transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-8">
          {loading && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] w-full skeleton rounded-2xl" />
              ))}
            </div>
          )}
          {!loading && q && results.length === 0 && (
            <div className="text-center py-16 motion-safe:animate-fade-up">
              <p className="text-base font-bold text-foreground">لا توجد نتائج</p>
              <p className="mt-1 text-sm text-foreground/60">لم نعثر على شيء لـ "{q}"</p>
            </div>
          )}
          {results.length > 0 && (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
              {results.map((p, i) => (
                <li key={p.id} className="motion-safe:animate-fade-up" style={{ animationDelay: `${Math.min(i * 25, 300)}ms` }}>
                  <PosterCard poster={p} rowId="search" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-10">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-lime transition">
            <ArrowRight className="h-4 w-4" />
            العودة إلى الرئيسية
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
