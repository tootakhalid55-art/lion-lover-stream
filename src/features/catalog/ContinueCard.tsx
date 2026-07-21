import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import type { Poster } from "@/services/api/types";
import { useInView } from "@/hooks/use-in-view";
import { track } from "@/lib/analytics";
import { watchPath } from "@/lib/user-data";

/** 16:9 resume card with prominent progress bar. */
export function ContinueCard({ poster, eager }: { poster: Poster; eager?: boolean }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const visible = eager || inView;
  const pct = Math.round((poster.progress ?? 0) * 100);
  return (
    <Link
      to={watchPath(poster.id) as "/"}
      aria-label={`متابعة ${poster.title}، ${pct}٪ تمت المشاهدة`}
      onClick={() => track({ name: "continue_watching_resumed", posterId: poster.id })}
      className="group block w-full text-right focus:outline-none"
    >
      <div
        ref={ref}
        className="relative aspect-video w-full overflow-hidden rounded-2xl ring-1 ring-white/[0.08] shadow-[0_12px_32px_-14px_rgba(0,0,0,0.8)] transition-all duration-500 ease-out will-change-transform group-hover:-translate-y-1 group-hover:ring-white/20 group-hover:shadow-[0_20px_50px_-18px_color-mix(in_oklab,var(--brand)_45%,rgba(0,0,0,0.9))]"
      >
        {!visible && <div className="absolute inset-0 skeleton" />}
        {visible && (
          <div className={`absolute inset-0 bg-gradient-to-br ${poster.gradient} motion-safe:animate-fade-in`}>
            {poster.imageUrl && (
              <img
                src={poster.imageUrl}
                alt=""
                aria-hidden
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
            <div className="absolute inset-0 grid place-items-center">
              <span className="grid h-12 w-12 place-items-center rounded-full glass-strong text-foreground transition-all duration-500 group-hover:scale-110 group-hover:bg-lime group-hover:text-neutral-900" style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
                <Play className="h-5 w-5 fill-current" />
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-extrabold text-foreground drop-shadow">{poster.title}</p>
                <span className="text-[10px] font-semibold text-foreground/80">{poster.duration}</span>
              </div>
              <div
                className="mt-2 h-1 w-full rounded-full bg-white/20 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <div className="h-full rounded-full bg-gradient-to-r from-lime to-lime/80 shadow-[0_0_12px_color-mix(in_oklab,var(--lime)_80%,transparent)]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
