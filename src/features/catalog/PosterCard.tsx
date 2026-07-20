import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bookmark, Play, Star } from "lucide-react";
import type { Poster } from "@/services/api/types";
import { useInView } from "@/hooks/use-in-view";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { track } from "@/lib/analytics";
import { BadgePill } from "./BadgePill";
import { detailPath, isFavorite, toggleFavorite, useFavorites } from "@/lib/user-data";

/**
 * Portrait 2:3 poster card. Navigates to the appropriate detail page.
 */
export function PosterCard({ poster, eager, rowId }: { poster: Poster; eager?: boolean; rowId: string }) {
  const { ref: inViewRef, inView } = useInView<HTMLDivElement>();
  const visible = eager || inView;
  const favs = useFavorites();
  const bookmarked = favs.some((f) => f.id === poster.id);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  const onMove = (e: React.MouseEvent) => {
    if (reduced) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--rx", `${(-py * 6).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * 8).toFixed(2)}deg`);
  };
  const onLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  const doToggle = () => {
    const nowFav = toggleFavorite({
      id: poster.id,
      title: poster.title,
      imageUrl: poster.imageUrl,
      gradient: poster.gradient,
      year: poster.year,
      rating: poster.rating,
    });
    track({ name: "favorite_toggled", posterId: poster.id, value: nowFav });
  };

  const startPress = () => {
    longPressTimer.current = setTimeout(() => {
      doToggle();
      navigator.vibrate?.(20);
    }, 500);
  };
  const endPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const toggleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    doToggle();
    navigator.vibrate?.(10);
  };

  const topBadges = poster.badges?.filter((b) => b === "NEW" || b === "TOP10") ?? [];
  const techBadges =
    poster.badges?.filter((b) => b === "HDR" || b === "DOLBY_VISION" || b === "DOLBY_ATMOS") ?? [];

  return (
    <Link
      to={detailPath(poster.id) as "/"}
      aria-label={`${poster.title} ${poster.year}${poster.rating ? `، تقييم ${poster.rating}` : ""}`}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchCancel={endPress}
      onClick={() => track({ name: "poster_clicked", posterId: poster.id, row: rowId })}
      className="group block w-full text-right focus:outline-none [perspective:1000px]"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div
        ref={(el) => {
          inViewRef.current = el;
          cardRef.current = el;
        }}
        style={{ transform: "rotateX(var(--rx,0)) rotateY(var(--ry,0))" }}
        className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] transition duration-300 ease-out will-change-transform [transform-style:preserve-3d] group-hover:-translate-y-1 group-hover:scale-[1.04] group-hover:brightness-110 group-hover:shadow-[0_25px_45px_-15px_rgba(0,0,0,0.9)] group-focus-visible:ring-2 group-focus-visible:ring-nav-active"
      >
        {!visible && <div className="absolute inset-0 skeleton rounded-2xl" />}
        {visible && (
          <div className={`absolute inset-0 bg-gradient-to-br ${poster.gradient} motion-safe:animate-fade-in`}>
            {poster.imageUrl && (
              <img
                src={poster.imageUrl}
                alt=""
                aria-hidden
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)]" />

            <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {topBadges.map((b) => (
                  <BadgePill key={b} kind={b} />
                ))}
                {poster.tag && !topBadges.length && (
                  <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-foreground backdrop-blur">
                    {poster.tag}
                  </span>
                )}
              </div>
              <span
                role="button"
                tabIndex={0}
                onClick={toggleBookmark}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doToggle(); } }}
                aria-label={bookmarked ? "إزالة من قائمتي" : "أضف إلى قائمتي"}
                aria-pressed={bookmarked}
                className={`grid h-7 w-7 place-items-center rounded-full backdrop-blur transition ${
                  bookmarked ? "bg-nav-active text-neutral-900" : "bg-black/50 text-foreground hover:bg-black/70"
                }`}
              >
                <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? "fill-current" : ""}`} />
              </span>
            </div>

            {poster.badges?.includes("TOP10") && poster.rank !== undefined && (
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-2 -right-1 text-[68px] font-black leading-none text-black/60 [text-shadow:_-1px_-1px_0_rgba(255,255,255,0.15)]"
              >
                {poster.rank}
              </span>
            )}

            {techBadges.length > 0 && (
              <div className="absolute top-10 right-2 flex flex-col items-end gap-1">
                {techBadges.map((b) => (
                  <BadgePill key={b} kind={b} />
                ))}
              </div>
            )}

            {poster.quality && (
              <span className="absolute bottom-16 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-nav-active ring-1 ring-nav-active/40 backdrop-blur">
                {poster.quality}
              </span>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-2.5 pt-10">
              <p className="text-[13px] font-extrabold leading-tight text-foreground drop-shadow line-clamp-2">
                {poster.title}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-foreground/80">
                <span>{poster.year}</span>
                {poster.ageRating && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="rounded bg-white/10 px-1 font-bold">{poster.ageRating}</span>
                  </>
                )}
                {poster.rating !== undefined && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5 fill-nav-active text-nav-active" />
                      {poster.rating.toFixed(1)}
                    </span>
                  </>
                )}
                {poster.duration && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate">{poster.duration}</span>
                  </>
                )}
              </div>
              {poster.progress !== undefined && poster.progress > 0 && (
                <div
                  className="mt-1.5 h-1 w-full rounded-full bg-white/15 overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(poster.progress * 100)}
                  aria-label="نسبة المشاهدة"
                >
                  <div
                    className="h-full rounded-full bg-nav-active"
                    style={{ width: `${Math.round(poster.progress * 100)}%` }}
                  />
                </div>
              )}
            </div>

            <div className="absolute inset-0 hidden md:grid place-items-center opacity-0 transition duration-200 group-hover:opacity-100 bg-black/40">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-pill text-pill-foreground shadow-[0_10px_30px_-6px_color-mix(in_oklab,var(--color-nav-active)_60%,transparent)] scale-90 transition duration-300 group-hover:scale-100">
                <Play className="h-5 w-5 fill-current" />
              </span>
            </div>
            {poster.description && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden md:block translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <div className="mx-2 mb-2 rounded-lg bg-black/75 p-2 text-[11px] leading-snug text-foreground/90 ring-1 ring-white/10 backdrop-blur">
                  <p className="line-clamp-3">{poster.description}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="mt-2 truncate text-xs text-foreground/85">
        {poster.title} · {poster.year}
      </p>
    </Link>
  );
}
