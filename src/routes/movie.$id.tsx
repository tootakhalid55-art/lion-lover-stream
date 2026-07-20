import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Play, Plus, Star } from "lucide-react";
import { getMovieDetail, type MovieDetail } from "@/lib/xtream.functions";
import { Header } from "@/features/navigation/Header";
import { BottomNav } from "@/features/navigation/BottomNav";
import { toggleFavorite, useFavorites, watchPath } from "@/lib/user-data";

export const Route = createFileRoute("/movie/$id")({
  component: MoviePage,
});

function MoviePage() {
  const { id } = Route.useParams();
  const fullId = `movie:${id}`;
  const [detail, setDetail] = useState<MovieDetail | null | undefined>(undefined);
  const favs = useFavorites();
  const isFav = favs.some((f) => f.id === fullId);

  useEffect(() => {
    void getMovieDetail({ data: { id: fullId } }).then(setDetail);
  }, [fullId]);

  if (detail === undefined) return <PageShell><p className="p-6 text-foreground/70">جاري التحميل…</p></PageShell>;
  if (detail === null) return <PageShell><p className="p-6 text-foreground/70">لم يتم العثور على الفيلم</p></PageShell>;

  return (
    <PageShell>
      <div className="relative">
        <div className={`absolute inset-x-0 top-0 h-[60vh] bg-gradient-to-br ${detail.gradient}`}>
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
                {detail.duration && <><span>·</span><span>{detail.duration}</span></>}
                {detail.genre && <><span>·</span><span>{detail.genre}</span></>}
                {detail.rating !== undefined && (
                  <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5">
                    <Star className="h-3 w-3 fill-nav-active text-nav-active" />{detail.rating.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={watchPath(fullId) as "/"}
                  className="inline-flex items-center gap-1.5 rounded-full bg-pill px-5 py-2.5 text-sm font-extrabold text-pill-foreground shadow-lg hover:brightness-110"
                >
                  <Play className="h-4 w-4 fill-current" /> تشغيل الآن
                </Link>
                <button
                  onClick={() => toggleFavorite({ id: fullId, title: detail.title, imageUrl: detail.imageUrl, gradient: detail.gradient, year: detail.year, rating: detail.rating })}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-5 py-2.5 text-sm font-extrabold text-foreground ring-1 ring-white/15 hover:bg-white/20"
                >
                  <Plus className="h-4 w-4" /> {isFav ? "في قائمتي" : "أضف إلى قائمتي"}
                </button>
              </div>
              {detail.plot && <p className="mt-6 text-sm leading-relaxed text-foreground/85">{detail.plot}</p>}
              {(detail.director || detail.cast) && (
                <dl className="mt-4 space-y-1 text-xs text-foreground/70">
                  {detail.director && <div><dt className="inline font-bold text-foreground/85">المخرج: </dt><dd className="inline">{detail.director}</dd></div>}
                  {detail.cast && <div><dt className="inline font-bold text-foreground/85">الأبطال: </dt><dd className="inline">{detail.cast}</dd></div>}
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
    <div className="min-h-dvh bg-background pb-32">
      <Header />
      <main>{children}</main>
      <BottomNav />
    </div>
  );
}
