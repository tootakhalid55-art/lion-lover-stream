import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Play, Plus, Star } from "lucide-react";
import { getSeriesDetail, type SeriesDetail } from "@/lib/xtream.functions";
import { Header } from "@/features/navigation/Header";
import { BottomNav } from "@/features/navigation/BottomNav";
import { toggleFavorite, useFavorites } from "@/lib/user-data";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/series/$id")({
  component: SeriesPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/series.$id.tsx" functionName="SeriesPage" lineNumber={23} />
  ),
});

function SeriesPage() {
  const { id } = Route.useParams();
  const fullId = `series:${id}`;
  const [detail, setDetail] = useState<SeriesDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [activeSeason, setActiveSeason] = useState<number>(0);
  const favs = useFavorites();
  const isFav = favs.some((f) => f.id === fullId);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setLoadError(null);
    setDetail(undefined);
    void getSeriesDetail({ data: { id: fullId } })
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        if (d?.seasons.length) setActiveSeason(d.seasons[0].season);
      })
      .catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("[runtime:exception]", { filename: "src/routes/series.$id.tsx", functionName: "SeriesPage.useEffect:getSeriesDetail", lineNumber: 27, message: error.message, stack: error.stack ?? null, requestUrl: window.location.href, httpStatus: null });
        if (alive) setLoadError(error);
      });
    return () => { alive = false; };
  }, [fullId]);

  if (loadError) return <RouteError error={loadError} filename="src/routes/series.$id.tsx" functionName="SeriesPage.useEffect:getSeriesDetail" lineNumber={27} />;
  if (detail === undefined) return <Shell><div className="mx-auto max-w-6xl px-4 pt-28"><div className="aspect-[21/9] w-full skeleton rounded-3xl" /></div></Shell>;
  if (detail === null) return <Shell><p className="p-6 pt-28 text-center text-foreground/70">لم يتم العثور على المسلسل</p></Shell>;

  const season = detail.seasons.find((s) => s.season === activeSeason);

  const playEpisode = async (epId: string, ext: string) => {
    const raw = epId.split(":")[1];
    navigate({ to: `/watch/series/${raw}` as "/", search: { ext } as never });
  };

  return (
    <Shell>
      <div className="relative">
        <div className={`absolute inset-x-0 top-0 h-[70vh] bg-gradient-to-br ${detail.gradient} overflow-hidden`}>
          {(detail.backdropUrl || detail.imageUrl) && (
            <img src={detail.backdropUrl || detail.imageUrl} alt="" aria-hidden className="h-full w-full object-cover opacity-65 motion-safe:animate-kenburns" />
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
            </div>
            <div className="motion-safe:animate-fade-up">
              <h1 className="text-3xl md:text-5xl font-black tracking-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]">{detail.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground/80">
                {detail.year && <span className="rounded bg-white/10 px-2 py-0.5 ring-1 ring-white/10 backdrop-blur">{detail.year}</span>}
                {detail.genre && <span className="rounded bg-white/10 px-2 py-0.5 ring-1 ring-white/10 backdrop-blur">{detail.genre}</span>}
                {detail.rating !== undefined && (
                  <span className="inline-flex items-center gap-1 rounded bg-[#F5C518]/95 px-2 py-0.5 text-black">
                    <Star className="h-3 w-3 fill-current" />{detail.rating.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => toggleFavorite({ id: fullId, title: detail.title, imageUrl: detail.imageUrl, gradient: detail.gradient, year: detail.year, rating: detail.rating })}
                  className={`inline-flex items-center gap-2 rounded-full glass px-7 py-3.5 text-sm font-black transition-all hover:scale-[1.03] ${isFav ? "text-lime ring-1 ring-lime/40" : "text-foreground hover:bg-white/15"}`}
                >
                  <Plus className="h-4 w-4" /> {isFav ? "في قائمتي" : "أضف إلى قائمتي"}
                </button>
              </div>
              {detail.plot && <p className="mt-6 text-sm md:text-base leading-relaxed text-foreground/90 max-w-2xl">{detail.plot}</p>}
            </div>
          </div>

          {detail.seasons.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
                {detail.seasons.map((s) => (
                  <button
                    key={s.season}
                    onClick={() => setActiveSeason(s.season)}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap ring-1 transition-all ${
                      s.season === activeSeason
                        ? "bg-lime text-neutral-900 ring-lime shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--lime)_60%,transparent)] scale-105"
                        : "glass text-foreground/80 hover:bg-white/15"
                    }`}
                  >
                    الموسم {s.season}
                  </button>
                ))}
              </div>

              <ul className="mt-4 space-y-2">
                {season?.episodes.map((ep, idx) => (
                  <li key={ep.id} style={{ animationDelay: `${idx * 40}ms` }} className="motion-safe:animate-fade-up">
                    <button
                      onClick={() => playEpisode(ep.id, ep.ext)}
                      className="group flex w-full items-center gap-3 rounded-2xl glass p-3 text-right transition-all hover:bg-white/10 hover:ring-lime/30 hover:-translate-y-0.5"
                    >
                      <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
                        {ep.imageUrl && <img src={ep.imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <span className="absolute inset-0 grid place-items-center">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-lime/95 text-neutral-900 scale-90 transition-transform duration-300 group-hover:scale-100">
                            <Play className="h-4 w-4 fill-current" />
                          </span>
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">
                          <span className="text-lime/80">{ep.episode}.</span> {ep.title}
                        </p>
                        {ep.plot && <p className="mt-1 line-clamp-2 text-xs text-foreground/70">{ep.plot}</p>}
                        {ep.duration && <p className="mt-1 text-[11px] text-foreground/60">{ep.duration}</p>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-32">
      <Header />
      <main>{children}</main>
      <BottomNav />
    </div>
  );
}
