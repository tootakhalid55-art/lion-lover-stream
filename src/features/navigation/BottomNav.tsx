import { Link, useLocation } from "@tanstack/react-router";
import { Bookmark, Home, MoreHorizontal, Search } from "lucide-react";
import { useScrollState } from "@/hooks/use-scroll-state";
import { track } from "@/lib/analytics";

const ITEMS = [
  { label: "المزيد", icon: MoreHorizontal, to: "/more" },
  { label: "قائمتي", icon: Bookmark, to: "/favorites" },
  { label: "البحث", icon: Search, to: "/search" },
  { label: "الرئيسية", icon: Home, to: "/" },
] as const;

/** Floating glass dock with animated active pill indicator. */
export function BottomNav() {
  const { hidden } = useScrollState();
  const pathname = useLocation({ select: (s) => s.pathname });
  const activeIndex = ITEMS.findIndex((it) =>
    it.to === "/" ? pathname === "/" : pathname.startsWith(it.to),
  );

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className={`fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 transition-all duration-500 ${
        hidden ? "translate-y-28 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      }`}
      style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 -bottom-2 h-8 rounded-full bg-brand/30 blur-2xl"
      />
      <div className="relative glass-strong rounded-full p-1.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)]">
        <ul className="relative flex items-center justify-around">
          {/* Sliding pill indicator */}
          {activeIndex >= 0 && (
            <li
              aria-hidden
              className="absolute top-0 bottom-0 rounded-full bg-gradient-to-br from-lime/95 to-lime/70 shadow-[0_0_24px_-4px_color-mix(in_oklab,var(--lime)_70%,transparent)] transition-all duration-500"
              style={{
                width: `${100 / ITEMS.length}%`,
                right: `${(activeIndex * 100) / ITEMS.length}%`,
                transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            />
          )}
          {ITEMS.map((it, i) => {
            const Icon = it.icon;
            const isActive = i === activeIndex;
            return (
              <li key={it.label} className="relative flex-1">
                <Link
                  to={it.to}
                  onClick={() => { track({ name: "navigation_tabbed", tab: it.label }); navigator.vibrate?.(8); }}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={it.label}
                  className={`relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-full px-3 py-2 transition-all duration-300 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/60 ${
                    isActive
                      ? "text-neutral-900"
                      : "text-foreground/65 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.6 : 2} />
                  <span className={`text-[10px] font-bold tracking-tight ${isActive ? "opacity-100" : "opacity-90"}`}>
                    {it.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
