import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Info, Play, Plus, Volume2, VolumeX } from "lucide-react";
import type { Hero as HeroData } from "@/services/api/types";
import novaLogo from "@/assets/nova-tv-logo.png.asset.json";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { track } from "@/lib/analytics";
import { heroDetailPath, heroWatchPath, toggleFavorite, useFavorites } from "@/lib/user-data";

const ROTATION_MS = 7000;

export function Hero({ heroes }: { heroes: HeroData[] }) {
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
      className="motion-safe:animate-hero-in"
    >
      <div className="relative overflow-hidden rounded-[28px] ring-1 ring-white/10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] aspect-[16/10] sm:aspect-[21/9] lg:aspect-[24/9]">
        {/* Ambient outer glow */}
        <div aria-hidden className="pointer-events-none absolute -inset-x-10 -bottom-8 h-24 bg-brand/30 blur-3xl" />

        {safeHeroes.map((slide, idx) => (
          <div
            key={slide.id}
            aria-hidden={idx !== safeIndex}
            className={`absolute inset-0 transition-opacity duration-[1100ms] ease-out ${idx === safeIndex ? "opacity-100" : "opacity-0"}`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${slide.gradient} ${idx === safeIndex && !reduced ? "motion-safe:animate-kenburns" : ""}`} />
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
            <div className="absolute inset-0 opacity-50 mix-blend-screen bg-[radial-gradient(circle_at_20%_15%,color-mix(in_oklab,var(--brand)_70%,transparent),transparent_60%)]" />
            <div className="absolute inset-0 opacity-40 mix-blend-overlay bg-[radial-gradient(circle_at_85%_85%,color-mix(in_oklab,var(--lime)_45%,transparent),transparent_55%)]" />
            {idx === safeIndex && slide.previewUrl && (
              <video
                key={slide.previewUrl}
                src={slide.previewUrl}
                autoPlay
                muted={muted}
                loop
                playsInline
                preload="none"
                className="absolute inset-0 h-full w-full object-cover opacity-95"
              />
            )}
          </div>
        ))}
        <img
          src={novaLogo.url}
          alt=""
          aria-hidden
          fetchPriority="high"
          className="absolute -left-8 bottom-0 h-full w-auto opacity-20 object-contain motion-safe:animate-float"
        />

        {/* Cinematic gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-background/50" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/90 to-transparent" />

        {h.previewUrl && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "تفعيل الصوت" : "كتم الصوت"}
            className="absolute top-4 left-4 z-20 grid h-10 w-10 place-items-center rounded-full glass text-foreground hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime transition-transform"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        )}

        {/* Floating info card */}
        <div
          key={safeIndex}
          className="relative z-10 flex h-full flex-col justify-end p-5 sm:p-8 lg:p-14 motion-safe:animate-fade-up"
        >
          <div className="flex flex-wrap items-center gap-2">
            {h.badge && (
              <span className="inline-flex w-fit items-center gap-1 rounded-full glass px-2.5 py-1 text-[11px] font-bold text-foreground/95">
                <span className="h-1 w-1 rounded-full bg-lime shadow-[0_0_8px_var(--lime)]" />
                {h.badge}
              </span>
            )}
            {h.imdb > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-[#F5C518] px-1.5 py-0.5 text-[10px] font-black text-black shadow-[0_4px_12px_-2px_rgba(245,197,24,0.5)]"
                aria-label={`تقييم IMDb ${h.imdb}`}
              >
                IMDb <span>{h.imdb.toFixed(1)}</span>
              </span>
            )}
            {h.ageRating && (
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-foreground/90 ring-1 ring-white/15 backdrop-blur">
                {h.ageRating}
              </span>
            )}
            {h.year && <span className="text-[11px] font-semibold text-foreground/70">{h.year}</span>}
          </div>
          <h1 className="mt-3 text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
            {h.title}
          </h1>
          <p className="mt-2 max-w-lg text-xs sm:text-sm lg:text-base font-medium text-foreground/85 drop-shadow line-clamp-2">
            {h.subtitle}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-foreground/70">
            {h.genres.map((g, gi) => (
              <span key={g} className="inline-flex items-center gap-1.5">
                {gi > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-lime/60" />}
                {g}
              </span>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              to={heroWatchPath(h.id) as "/"}
              onClick={() => track({ name: "hero_interacted", heroId: h.id, action: "play" })}
              className="group inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-black text-neutral-900 shadow-[0_15px_40px_-10px_color-mix(in_oklab,var(--lime)_60%,transparent)] transition-all duration-300 hover:scale-[1.03] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
            >
              <Play className="h-4 w-4 fill-current transition-transform group-hover:scale-110" />
              تشغيل الآن
            </Link>
            <button
              type="button"
              onClick={() => {
                const inner = h.id.startsWith("hero-") ? h.id.slice(5) : h.id;
                const nowFav = toggleFavorite({ id: inner, title: h.title, imageUrl: h.imageUrl, gradient: h.gradient, year: h.year, rating: h.imdb });
                track({ name: "hero_interacted", heroId: h.id, action: nowFav ? "add_list" : "remove_list" });
              }}
              className="inline-flex items-center gap-2 rounded-full glass px-6 py-3 text-sm font-black text-foreground transition-all duration-300 hover:scale-[1.03] hover:bg-white/15 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime"
              style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
            >
              <Plus className="h-4 w-4" />
              {favBookmarked ? "في قائمتي" : "أضف إلى قائمتي"}
            </button>
            <Link
              to={heroDetailPath(h.id) as "/"}
              aria-label="تفاصيل"
              onClick={() => track({ name: "hero_interacted", heroId: h.id, action: "info" })}
              className="inline-flex items-center gap-1.5 rounded-full glass px-4 py-3 text-sm font-bold text-foreground/90 hover:bg-white/15 hover:scale-[1.03] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            >
              <Info className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Animated progress indicators */}
        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1.5">
          {safeHeroes.map((slide, idx) => {
            const isActive = idx === safeIndex;
            const isPast = idx < safeIndex;
            const fill = isActive ? progress : isPast ? 1 : 0;
            return (
              <button
                key={slide.id}
                aria-label={`الشريحة ${idx + 1}: ${slide.title}`}
                aria-current={isActive}
                onClick={() => { goTo(idx); track({ name: "hero_interacted", heroId: slide.id, action: "dot" }); }}
                className={`h-1.5 rounded-full overflow-hidden bg-white/25 backdrop-blur transition-all duration-500 ${isActive ? "w-10" : "w-2 hover:bg-white/50"}`}
              >
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-lime to-lime/70 shadow-[0_0_8px_color-mix(in_oklab,var(--lime)_80%,transparent)]"
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
