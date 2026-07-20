import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import type { Poster } from "@/services/api/types";
import { useInView } from "@/hooks/use-in-view";
import { track } from "@/lib/analytics";
import { watchPath } from "@/lib/user-data";

/** Landscape 16:9 resume card used in the Continue Watching row. */
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
        className="relative aspect-video w-full overflow-hidden rounded-xl ring-1 ring-white/10 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] transition duration-300 ease-out will-change-transform group-hover:-translate-y-0.5 group-hover:brightness-110"
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
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
            <div className="absolute inset-0 grid place-items-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-foreground ring-1 ring-white/20 backdrop-blur transition group-hover:bg-black/70 group-hover:scale-105">
                <Play className="h-5 w-5 fill-current" />
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-extrabold text-foreground drop-shadow">{poster.title}</p>
                <span className="text-[10px] text-foreground/80">{poster.duration}</span>
              </div>
              <div
                className="mt-1.5 h-1 w-full rounded-full bg-white/20 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <div className="h-full rounded-full bg-nav-active" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
