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

/** Floating bottom navigation using real routes. */
export function BottomNav() {
  const { hidden } = useScrollState();
  const pathname = useLocation({ select: (s) => s.pathname });

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className={`fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 transition-all duration-300 ease-out ${
        hidden ? "translate-y-24 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      }`}
      style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
    >
      <ul className="flex items-center justify-around rounded-full border border-white/10 bg-neutral-900/60 px-2 py-2 shadow-2xl backdrop-blur-xl">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          const isActive = it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
          return (
            <li key={it.label}>
              <Link
                to={it.to}
                onClick={() => { track({ name: "navigation_tabbed", tab: it.label }); navigator.vibrate?.(8); }}
                aria-current={isActive ? "page" : undefined}
                aria-label={it.label}
                className={`relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-full px-3 py-1.5 transition-all duration-300 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active ${
                  isActive
                    ? "bg-nav-active/20 text-nav-active shadow-[0_0_20px_-4px_color-mix(in_oklab,var(--color-nav-active)_70%,transparent)] scale-105"
                    : "text-foreground/70 hover:text-foreground hover:bg-white/5"
                }`}
                style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                <span className="text-[10px] font-bold">{it.label}</span>
                {isActive && (
                  <span aria-hidden className="absolute -bottom-1 h-1 w-1 rounded-full bg-nav-active motion-safe:animate-glow" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
