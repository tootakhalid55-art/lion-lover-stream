import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Play, Plus, Star } from "lucide-react";
import { getSeriesDetail, type SeriesDetail } from "@/lib/xtream.functions";
import { Header } from "@/features/navigation/Header";
import { BottomNav } from "@/features/navigation/BottomNav";
import { toggleFavorite, useFavorites } from "@/lib/user-data";
import { useNavigate } from "@tanstack/react-router";
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
        console.error("[runtime:exception]", {
          filename: "src/routes/series.$id.tsx",
          functionName: "SeriesPage.useEffect:getSeriesDetail",
          lineNumber: 27,
          message: error.message,
          stack: error.stack ?? null,
          requestUrl: window.location.href,
          httpStatus: null,
        });
        if (alive) setLoadError(error);
      });
    return () => {
      alive = false;
    };
  }, [fullId]);

  if (loadError) return <RouteError error={loadError} filename="src/routes/series.$id.tsx" functionName="SeriesPage.useEffect:getSeriesDetail" lineNumber={27} />;
  if (detail === undefined)
    return <Shell><p className="p-6 text-foreground/70">جاري التحميل…</p></Shell>;
  if (detail === null)
    return <Shell><p className="p-6 text-foreground/70">لم يتم العثور على المسلسل</p></Shell>;

  const season = detail.seasons.find((s) => s.season === activeSeason);

  const playEpisode = async (epId: string, ext: string) => {
    // Navigate to watch page with episode raw id
    const raw = epId.split(":")[1];
    navigate({ to: `/watch/series/${raw}` as "/", search: { ext } as never });
  };

  return (
    <Shell>
      <div className="relative">
        <div className={`absolute inset-x-0 top-0 h-[55vh] bg-gradient-to-br ${detail.gradient}`}>
          {(detail.backdropUrl || detail.imageUrl) && (
            <img src={detail.backdropUrl || detail.imageUrl} alt="" aria-hidden className="h-full w-full object-cover opacity-60" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 pt-28">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-foreground/70 hover:text-foreground">
            <ArrowRight className="h-4 w-4" /> رجوع
          </Link>
          <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
            <div className="mx-auto w-40 md:w-full aspect-[2/3] overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-2xl">
              {detail.imageUrl && <img src={detail.imageUrl} alt={detail.title} className="h-full w-full object-cover" />}
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground md:text-3xl">{detail.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-foreground/70">
                {detail.year && <span>{detail.year}</span>}
                {detail.genre && <><span>·</span><span>{detail.genre}</span></>}
                {detail.rating !== undefined && (
                  <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5">
                    <Star className="h-3 w-3 fill-nav-active text-nav-active" />{detail.rating.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => toggleFavorite({ id: fullId, title: detail.title, imageUrl: detail.imageUrl, gradient: detail.gradient, year: detail.year, rating: detail.rating })}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-5 py-2.5 text-sm font-extrabold text-foreground ring-1 ring-white/15 hover:bg-white/20"
                >
                  <Plus className="h-4 w-4" /> {isFav ? "في قائمتي" : "أضف إلى قائمتي"}
                </button>
              </div>
              {detail.plot && <p className="mt-4 text-sm leading-relaxed text-foreground/85">{detail.plot}</p>}
            </div>
          </div>

          {detail.seasons.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                {detail.seasons.map((s) => (
                  <button
                    key={s.season}
                    onClick={() => setActiveSeason(s.season)}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap ring-1 transition ${
                      s.season === activeSeason
                        ? "bg-nav-active/20 text-nav-active ring-nav-active/40"
                        : "bg-white/5 text-foreground/80 ring-white/10 hover:bg-white/10"
                    }`}
                  >
                    الموسم {s.season}
                  </button>
                ))}
              </div>

              <ul className="mt-4 space-y-2">
                {season?.episodes.map((ep) => (
                  <li key={ep.id}>
                    <button
                      onClick={() => playEpisode(ep.id, ep.ext)}
                      className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-right ring-1 ring-white/10 transition hover:bg-white/10"
                    >
                      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-black/40">
                        {ep.imageUrl && <img src={ep.imageUrl} alt="" className="h-full w-full object-cover" />}
                        <span className="absolute inset-0 grid place-items-center">
                          <Play className="h-5 w-5 fill-current text-foreground drop-shadow" />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">
                          {ep.episode}. {ep.title}
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
    <div className="min-h-dvh bg-background pb-32">
      <Header />
      <main>{children}</main>
      <BottomNav />
    </div>
  );
}
