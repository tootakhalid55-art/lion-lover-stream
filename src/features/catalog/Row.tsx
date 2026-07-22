import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Poster } from "@/services/api/types";
import { useRowScrollMemory } from "@/hooks/use-row-scroll-memory";
import { PosterCard } from "./PosterCard";
import { ContinueCard } from "./ContinueCard";


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

  useEffect(() => { updateEdges(); }, [updateEdges]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.85;
    el.scrollBy({ left: dir * -amount, behavior: "smooth" });
  };

  const isContinue = variant === "continue";

  return (
    <section aria-labelledby={`row-${id}`} className="space-y-4 group/row motion-safe:animate-fade-up">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span aria-hidden className="h-6 w-1 rounded-full bg-gradient-to-b from-lime to-brand" />
          <h2 id={`row-${id}`} className="truncate text-lg sm:text-xl lg:text-2xl font-black tracking-tight">
            {title}
          </h2>
        </div>
        <button className="group/btn inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition hover:text-lime focus:outline-none focus-visible:text-lime">
          عرض الكل
          <ChevronLeft className="h-4 w-4 transition-transform group-hover/btn:-translate-x-0.5" />
        </button>
      </div>
      <div className="relative">
        <button
          type="button"
          aria-label="السابق"
          onClick={() => scrollBy(-1)}
          disabled={edges.start}
          className="hidden lg:grid absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-3 h-12 w-12 place-items-center rounded-full glass-strong text-foreground opacity-0 group-hover/row:opacity-100 transition-all duration-300 disabled:opacity-0 hover:scale-110 hover:ring-lime-glow focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-lime"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          aria-label="التالي"
          onClick={() => scrollBy(1)}
          disabled={edges.end}
          className="hidden lg:grid absolute left-0 top-1/2 z-10 -translate-y-1/2 -translate-x-3 h-12 w-12 place-items-center rounded-full glass-strong text-foreground opacity-0 group-hover/row:opacity-100 transition-all duration-300 disabled:opacity-0 hover:scale-110 hover:ring-lime-glow focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-lime"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
        </button>

        <div className="-mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 overflow-x-auto scrollbar-hide snap-row momentum">
          <ul ref={scrollerRef} onScroll={updateEdges} className="flex gap-3 sm:gap-4 lg:gap-5 min-w-max">
            {items.map((p, i) => (
              <li
                key={p.id}
                className={`shrink-0 snap-start ${
                  isContinue ? "w-60 sm:w-72 md:w-80" : "w-32 sm:w-40 md:w-44 lg:w-48"
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
