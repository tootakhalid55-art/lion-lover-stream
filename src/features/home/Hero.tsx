import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Info, Play, Plus, Volume2, VolumeX } from "lucide-react";
import type { Hero as HeroData } from "@/services/api/types";
import lionLogo from "@/assets/lion-logo.png";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { track } from "@/lib/analytics";
import { heroDetailPath, heroWatchPath, toggleFavorite, useFavorites } from "@/lib/user-data";

const ROTATION_MS = 7000;

/**
 * Auto-rotating featured carousel with:
 * - Ken Burns background + optional muted preview video
 * - IMDb, age rating, genres, year metadata
 * - Animated progress bars per slide
 * - Swipe gestures (RTL-aware) and hover/touch pause
 */
export function Hero({ heroes }: { heroes: HeroData[] }) {
  // Normalize incoming data — Xtream feeds can omit fields; keep UI resilient.
  const safeHeroes: HeroData[] = (Array.isArray(heroes) ? heroes : [])
    .filter((s): s is HeroData => !!s && typeof s === "object" && !!s.id)
    .map((s) => ({
      ...s,
      title: s.title ?? "",
      subtitle: s.subtitle ?? "",
      badge: s.badge ?? "",
      gradient: s.gradient ?? "from-neutral-800 to-neutral-950",
      imdb: typeof s.imdb === "number" && Number.isFinite(s.imdb) ? s.imdb : 0,
      genres: Array.isArray(s.genres) ? s.genres : [],
      year: s.year ?? "",
      ageRating: s.ageRating ?? "",
    }));

  const total = safeHeroes.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const reduced = usePrefersReducedMotion();
  const touchStartX = useRef<number | null>(null);
  const favs = useFavorites();

  useEffect(() => {
    if (paused || reduced || total < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % total), ROTATION_MS);
    return () => clearInterval(t);
  }, [paused, total, reduced]);

  useEffect(() => {
    if (paused || reduced) return;
    setProgress(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ROTATION_MS);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i, paused, reduced]);

  if (total === 0) return null;
  const safeIndex = Math.min(i, total - 1);

  const goTo = (idx: number) => setI(((idx % total) + total) % total);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start !== null) {
      const end = e.changedTouches[0]?.clientX ?? start;
      const dx = end - start;
      if (Math.abs(dx) > 40) {
        goTo(dx < 0 ? safeIndex + 1 : safeIndex - 1);
        const swiped = safeHeroes[safeIndex];
        if (swiped) track({ name: "hero_interacted", heroId: swiped.id, action: "swipe" });
      }
    }
    setTimeout(() => setPaused(false), 3000);
  };

  const h = safeHeroes[safeIndex]!;
  const heroInner = h.id.startsWith("hero-") ? h.id.slice(5) : h.id;
  const favBookmarked = favs.some((f) => f.id === heroInner);

  return (
    <section
      aria-label="محتوى مميز"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] aspect-[16/10] sm:aspect-[21/9] lg:aspect-[24/9] motion-safe:animate-fade-in">
        {safeHeroes.map((slide, idx) => (
          <div
            key={slide.id}
            aria-hidden={idx !== safeIndex}
            className={`absolute inset-0 transition-opacity duration-[900ms] ease-out ${idx === safeIndex ? "opacity-100" : "opacity-0"}`}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${slide.gradient} ${idx === safeIndex && !reduced ? "motion-safe:animate-kenburns" : ""}`}
            />
            {slide.imageUrl && (
              <img
                src={slide.imageUrl}
                alt=""
                aria-hidden
                loading={idx === safeIndex ? "eager" : "lazy"}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div className="absolute inset-0 opacity-40 mix-blend-screen bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--color-brand)_60%,transparent),transparent_60%)]" />
            {idx === safeIndex && slide.previewUrl && (
              <video
                key={slide.previewUrl}
                src={slide.previewUrl}
                autoPlay
                muted={muted}
                loop
                playsInline
                preload="none"
                className="absolute inset-0 h-full w-full object-cover opacity-90"
              />
            )}
          </div>
        ))}
        <img
          src={lionLogo}
          alt=""
          aria-hidden
          fetchPriority="high"
          className="absolute -left-6 bottom-0 h-full w-auto opacity-25 grayscale object-contain"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black/40" />

        {h.previewUrl && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "تفعيل الصوت" : "كتم الصوت"}
            className="absolute top-3 left-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-foreground ring-1 ring-white/15 backdrop-blur hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        )}

        <div
          key={safeIndex}
          className="relative z-10 flex h-full flex-col justify-end p-5 sm:p-8 lg:p-12 motion-safe:animate-hero-in"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-foreground/90 backdrop-blur ring-1 ring-white/15">
              {h.badge}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md bg-[#F5C518] px-1.5 py-0.5 text-[10px] font-black text-black"
              aria-label={`تقييم IMDb ${h.imdb}`}
            >
              IMDb
              <span className="text-black">{h.imdb.toFixed(1)}</span>
            </span>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-foreground/90 ring-1 ring-white/15">
              {h.ageRating}
            </span>
            <span className="text-[11px] font-medium text-foreground/70">{h.year}</span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight">{h.title}</h1>
          <p className="mt-1 max-w-md text-xs sm:text-sm lg:text-base text-foreground/80">{h.subtitle}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-foreground/70">
            {h.genres.map((g, gi) => (
              <span key={g} className="inline-flex items-center gap-1.5">
                {gi > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-foreground/40" />}
                {g}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              to={heroWatchPath(h.id) as "/"}
              onClick={() => track({ name: "hero_interacted", heroId: h.id, action: "play" })}
              className="inline-flex items-center gap-1.5 rounded-full bg-pill px-5 py-2.5 text-sm font-extrabold text-pill-foreground shadow-lg transition duration-200 hover:brightness-110 hover:scale-[1.02] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Play className="h-4 w-4 fill-current" />
              تشغيل الآن
            </Link>
            <button
              type="button"
              onClick={() => {
                const inner = h.id.startsWith("hero-") ? h.id.slice(5) : h.id;
                const nowFav = toggleFavorite({ id: inner, title: h.title, imageUrl: h.imageUrl, gradient: h.gradient, year: h.year, rating: h.imdb });
                track({ name: "hero_interacted", heroId: h.id, action: nowFav ? "add_list" : "remove_list" });
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-5 py-2.5 text-sm font-extrabold text-foreground ring-1 ring-white/15 backdrop-blur-md transition duration-200 hover:bg-white/20 hover:scale-[1.02] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active"
            >
              <Plus className="h-4 w-4" />
              {favBookmarked ? "في قائمتي" : "أضف إلى قائمتي"}
            </button>
            <Link
              to={heroDetailPath(h.id) as "/"}
              aria-label="تفاصيل"
              onClick={() => track({ name: "hero_interacted", heroId: h.id, action: "info" })}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3.5 py-2.5 text-sm font-bold text-foreground/85 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active"
            >
              <Info className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1.5">
          {safeHeroes.map((slide, idx) => {
            const isActive = idx === safeIndex;
            const isPast = idx < safeIndex;
            const fill = isActive ? progress : isPast ? 1 : 0;
            return (
              <button
                key={slide.id}
                aria-label={`الشريحة ${idx + 1}: ${slide.title}`}
                aria-current={isActive}
                onClick={() => {
                  goTo(idx);
                  track({ name: "hero_interacted", heroId: slide.id, action: "dot" });
                }}
                className={`h-1.5 rounded-full overflow-hidden bg-white/25 transition-all duration-300 ${isActive ? "w-8" : "w-2 hover:bg-white/50"}`}
              >
                <span
                  className="block h-full rounded-full bg-nav-active"
                  style={{ width: `${fill * 100}%`, transition: reduced ? undefined : "width 60ms linear" }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
