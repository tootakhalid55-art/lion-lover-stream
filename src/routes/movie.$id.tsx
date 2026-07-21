import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Play, Plus, Star } from "lucide-react";
import { getMovieDetail, type MovieDetail } from "@/lib/xtream.functions";
import { Header } from "@/features/navigation/Header";
import { BottomNav } from "@/features/navigation/BottomNav";
import { toggleFavorite, useFavorites, watchPath } from "@/lib/user-data";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/movie/$id")({
  component: MoviePage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/movie.$id.tsx" functionName="MoviePage" lineNumber={20} />
  ),
});

function MoviePage() {
  const { id } = Route.useParams();
  const fullId = `movie:${id}`;
  const [detail, setDetail] = useState<MovieDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const favs = useFavorites();
  const isFav = favs.some((f) => f.id === fullId);

  useEffect(() => {
    let alive = true;
    setLoadError(null);
    setDetail(undefined);
    void getMovieDetail({ data: { id: fullId } })
      .then((d) => { if (alive) setDetail(d); })
      .catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("[runtime:exception]", { filename: "src/routes/movie.$id.tsx", functionName: "MoviePage.useEffect:getMovieDetail", lineNumber: 24, message: error.message, stack: error.stack ?? null, requestUrl: window.location.href, httpStatus: null });
        if (alive) setLoadError(error);
      });
    return () => { alive = false; };
  }, [fullId]);

  if (loadError) return <RouteError error={loadError} filename="src/routes/movie.$id.tsx" functionName="MoviePage.useEffect:getMovieDetail" lineNumber={24} />;
  if (detail === undefined) return <PageShell><div className="mx-auto max-w-6xl px-4 pt-28"><div className="aspect-[21/9] w-full skeleton rounded-3xl" /></div></PageShell>;
  if (detail === null) return <PageShell><p className="p-6 pt-28 text-center text-foreground/70">لم يتم العثور على الفيلم</p></PageShell>;

  return (
    <PageShell>
      <div className="relative">
        {/* Cinematic backdrop */}
        <div className={`absolute inset-x-0 top-0 h-[75vh] bg-gradient-to-br ${detail.gradient} overflow-hidden`}>
          {(detail.backdropUrl || detail.imageUrl) && (
            <img src={detail.backdropUrl || detail.imageUrl} alt="" aria-hidden className="h-full w-full object-cover opacity-70 motion-safe:animate-kenburns" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-l from-background/50 via-transparent to-transparent" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 pt-24">
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-bold text-foreground/90 hover:bg-white/15 transition">
            <ArrowRight className="h-3.5 w-3.5" /> رجوع
          </Link>
          <div className="mt-8 grid gap-8 md:grid-cols-[260px_1fr]">
            <div className="relative mx-auto w-44 md:w-full aspect-[2/3] overflow-hidden rounded-3xl ring-1 ring-white/15 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] motion-safe:animate-spring-in">
              {detail.imageUrl && <img src={detail.imageUrl} alt={detail.title} className="h-full w-full object-cover" />}
              <div className="absolute inset-x-0 -bottom-3 h-6 bg-brand/40 blur-2xl -z-10" />
            </div>
            <div className="motion-safe:animate-fade-up">
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]">{detail.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground/80">
                {detail.year && <span className="rounded bg-white/10 px-2 py-0.5 ring-1 ring-white/10 backdrop-blur">{detail.year}</span>}
                {detail.duration && <span className="rounded bg-white/10 px-2 py-0.5 ring-1 ring-white/10 backdrop-blur">{detail.duration}</span>}
                {detail.genre && <span className="rounded bg-white/10 px-2 py-0.5 ring-1 ring-white/10 backdrop-blur">{detail.genre}</span>}
                {detail.rating !== undefined && (
                  <span className="inline-flex items-center gap-1 rounded bg-[#F5C518]/95 px-2 py-0.5 text-black">
                    <Star className="h-3 w-3 fill-current" />{detail.rating.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to={watchPath(fullId) as "/"}
                  search={{ ext: detail.ext } as never}
                  className="group inline-flex items-center gap-2 rounded-full bg-lime px-7 py-3.5 text-sm font-black text-neutral-900 shadow-[0_15px_40px_-10px_color-mix(in_oklab,var(--lime)_65%,transparent)] transition-all hover:scale-[1.03] active:scale-95"
                  style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                >
                  <Play className="h-4 w-4 fill-current transition-transform group-hover:scale-110" /> تشغيل الآن
                </Link>
                <button
                  onClick={() => toggleFavorite({ id: fullId, title: detail.title, imageUrl: detail.imageUrl, gradient: detail.gradient, year: detail.year, rating: detail.rating })}
                  className={`inline-flex items-center gap-2 rounded-full glass px-7 py-3.5 text-sm font-black transition-all hover:scale-[1.03] active:scale-95 ${isFav ? "text-lime ring-1 ring-lime/40" : "text-foreground hover:bg-white/15"}`}
                  style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                >
                  <Plus className="h-4 w-4" /> {isFav ? "في قائمتي" : "أضف إلى قائمتي"}
                </button>
              </div>
              {detail.plot && (
                <p className="mt-8 text-sm md:text-base leading-relaxed text-foreground/90 max-w-2xl">{detail.plot}</p>
              )}
              {(detail.director || detail.cast) && (
                <dl className="mt-6 space-y-2 text-xs text-foreground/70 max-w-2xl">
                  {detail.director && <div><dt className="inline font-bold text-lime/90">المخرج: </dt><dd className="inline">{detail.director}</dd></div>}
                  {detail.cast && <div><dt className="inline font-bold text-lime/90">الأبطال: </dt><dd className="inline">{detail.cast}</dd></div>}
                </dl>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-32">
      <Header />
      <main>{children}</main>
      <BottomNav />
    </div>
  );
}
