import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Poster } from "@/services/api/types";
import { useRowScrollMemory } from "@/hooks/use-row-scroll-memory";
import { PosterCard } from "./PosterCard";
import { ContinueCard } from "./ContinueCard";

/**
 * Horizontal, snap-scrolling row of cards.
 * Remembers scroll position across mounts and shows desktop scroll buttons
 * with hidden-at-edge affordances.
 */
export function Row({
  id,
  title,
  items,
  variant = "poster",
}: {
  id: string;
  title: string;
  items: Poster[];
  variant?: "poster" | "continue";
}) {
  const scrollerRef = useRowScrollMemory<HTMLUListElement>(id);
  const [edges, setEdges] = useState<{ start: boolean; end: boolean }>({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const distance = Math.abs(el.scrollLeft);
    setEdges({ start: distance < 4, end: distance >= max - 4 });
  }, [scrollerRef]);

  useEffect(() => {
    updateEdges();
  }, [updateEdges]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.85;
    el.scrollBy({ left: dir * -amount, behavior: "smooth" });
  };

  const isContinue = variant === "continue";

  return (
    <section aria-labelledby={`row-${id}`} className="space-y-3 group/row motion-safe:animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 id={`row-${id}`} className="text-lg sm:text-xl lg:text-2xl font-extrabold">
          {title}
        </h2>
        <button className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition hover:text-foreground focus:outline-none focus-visible:text-foreground">
          عرض الكل
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
      <div className="relative">
        <button
          type="button"
          aria-label="السابق"
          onClick={() => scrollBy(-1)}
          disabled={edges.start}
          className="hidden lg:grid absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-2 h-11 w-11 place-items-center rounded-full bg-neutral-900/80 text-foreground ring-1 ring-white/10 backdrop-blur opacity-0 group-hover/row:opacity-100 transition disabled:opacity-0 hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="التالي"
          onClick={() => scrollBy(1)}
          disabled={edges.end}
          className="hidden lg:grid absolute left-0 top-1/2 z-10 -translate-y-1/2 -translate-x-2 h-11 w-11 place-items-center rounded-full bg-neutral-900/80 text-foreground ring-1 ring-white/10 backdrop-blur opacity-0 group-hover/row:opacity-100 transition disabled:opacity-0 hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="-mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 overflow-x-auto scrollbar-hide snap-row momentum">
          <ul ref={scrollerRef} onScroll={updateEdges} className="flex gap-3 sm:gap-4 lg:gap-5 min-w-max">
            {items.map((p, i) => (
              <li
                key={p.id}
                className={`shrink-0 snap-start ${
                  isContinue ? "w-56 sm:w-64 md:w-72" : "w-32 sm:w-40 md:w-44 lg:w-48"
                }`}
              >
                {isContinue ? (
                  <ContinueCard poster={p} eager={i < 2} />
                ) : (
                  <PosterCard poster={p} eager={i < 3} rowId={id} />
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
