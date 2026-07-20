import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search as SearchIcon, ArrowRight } from "lucide-react";
import { api } from "@/services/api";
import { Header } from "@/features/navigation/Header";
import { BottomNav } from "@/features/navigation/BottomNav";
import { PosterCard } from "@/features/catalog/PosterCard";
import type { Poster } from "@/services/api/types";
import { detailPath } from "@/lib/user-data";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "البحث — LionTV" }, { name: "description", content: "ابحث عن الأفلام والمسلسلات." }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Poster[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    void api.search.suggest(q, "all").then((r) => {
      if (alive) { setResults(r); setLoading(false); }
    });
    return () => { alive = false; };
  }, [q]);

  return (
    <div className="min-h-dvh bg-background pb-32">
      <Header />
      <main className="mx-auto max-w-5xl px-4 pt-24">
        <div className="flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10 focus-within:ring-nav-active/60">
          <SearchIcon className="h-5 w-5 text-foreground/70" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث في أفلام، مسلسلات، قنوات…"
            className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {q && (
            <button onClick={() => setQ("")} className="rounded-full px-2 py-1 text-xs text-foreground/70 hover:bg-white/10">مسح</button>
          )}
        </div>

        <div className="mt-6">
          {loading && <p className="text-sm text-foreground/60">جاري البحث…</p>}
          {!loading && q && results.length === 0 && (
            <p className="text-sm text-foreground/60">لا توجد نتائج لـ "{q}"</p>
          )}
          {results.length > 0 && (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {results.map((p) => (
                <li key={p.id}><PosterCard poster={p} rowId="search" /></li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground">
            <ArrowRight className="h-4 w-4" />
            العودة إلى الرئيسية
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
