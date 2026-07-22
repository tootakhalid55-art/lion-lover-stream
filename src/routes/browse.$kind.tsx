import { useMemo } from "react";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import { Header } from "@/features/navigation/Header";
import { BottomNav } from "@/features/navigation/BottomNav";
import { PosterCard } from "@/features/catalog/PosterCard";
import { RouteError } from "@/components/RouteError";
import {
  browseQueryOptions,
  type BrowseKind,
  browseTitle,
} from "@/features/catalog/browse-query";

const KINDS = ["movies", "series", "live"] as const;

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "recent").default("recent"),
});

export const Route = createFileRoute("/browse/$kind")({
  validateSearch: zodValidator(searchSchema),
  parseParams: ({ kind }) => {
    if (!KINDS.includes(kind as BrowseKind)) throw notFound();
    return { kind: kind as BrowseKind };
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(browseQueryOptions(params.kind)),
  head: ({ params }) => {
    const t = browseTitle(params.kind as BrowseKind);
    return {
      meta: [
        { title: `${t} — LionTV` },
        { name: "description", content: `تصفح ${t} على LionTV.` },
        { property: "og:title", content: `${t} — LionTV` },
        { property: "og:description", content: `تصفح ${t} على LionTV.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: BrowsePage,
  pendingComponent: BrowseSkeleton,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/browse.$kind.tsx" functionName="BrowsePage" lineNumber={1} />
  ),
  notFoundComponent: () => (
    <div className="min-h-dvh grid place-items-center text-foreground/70">القسم غير موجود</div>
  ),
});

function BrowsePage() {
  const { kind } = Route.useParams();
  const { q, sort } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: items } = useSuspenseQuery(browseQueryOptions(kind));

  const filtered = useMemo(() => {
    const list = q
      ? items.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()))
      : items.slice();
    if (sort === "rating") {
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sort === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title, "ar"));
    }
    return list;
  }, [items, q, sort]);

  const title = browseTitle(kind);

  return (
    <div className="min-h-dvh pb-32 motion-safe:animate-fade-in">
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pt-24 space-y-6">
        <div className="motion-safe:animate-fade-up">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-lime shadow-[0_0_12px_var(--lime)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime/90">تصفح</p>
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
            <span className="text-gradient-brand">{title}</span>
          </h1>
          <p className="mt-1 text-sm text-foreground/60">{filtered.length} عنصر</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <label className="relative flex-1 group">
            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/50 group-focus-within:text-lime transition-colors" />
            <input
              type="search"
              inputMode="search"
              placeholder="ابحث ضمن هذا القسم"
              value={q}
              onChange={(e) =>
                navigate({ search: (prev: { q: string; sort: string }) => ({ ...prev, q: e.target.value }), replace: true })
              }
              className="w-full rounded-2xl glass px-4 pr-10 py-3 text-sm text-foreground placeholder:text-foreground/40 outline-none ring-1 ring-white/10 focus:ring-lime/50 transition"
            />
          </label>
          <label className="relative inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-foreground/60" />
            <select
              value={sort}
              onChange={(e) =>
                navigate({ search: (prev) => ({ ...prev, sort: e.target.value }), replace: true })
              }
              className="rounded-2xl glass px-3 py-3 text-sm text-foreground outline-none ring-1 ring-white/10 focus:ring-lime/50 transition"
            >
              <option value="recent">الأحدث</option>
              <option value="rating">الأعلى تقييماً</option>
              <option value="title">أبجدي</option>
            </select>
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="grid place-items-center rounded-2xl glass py-16 text-foreground/70 text-sm">
            لا توجد نتائج مطابقة.
          </div>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
            {filtered.map((p, i) => (
              <li key={p.id} className="motion-safe:animate-fade-in" style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}>
                <PosterCard poster={p} rowId={`browse-${kind}`} eager={i < 6} />
              </li>
            ))}
          </ul>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function BrowseSkeleton() {
  return (
    <div className="min-h-dvh pb-32">
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pt-24 space-y-6">
        <div className="space-y-3">
          <div className="h-4 w-24 skeleton rounded-full" />
          <div className="h-9 w-56 skeleton rounded-xl" />
        </div>
        <div className="h-12 w-full skeleton rounded-2xl" />
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
          {Array.from({ length: 18 }).map((_, i) => (
            <li key={i} className="space-y-2">
              <div className="aspect-[2/3] w-full skeleton rounded-2xl" />
              <div className="h-3 w-3/4 skeleton rounded" />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
