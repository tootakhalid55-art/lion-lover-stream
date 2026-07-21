import type { ReactNode } from "react";

/** Round 40×40 icon button with glass hover, spring press. */
export function IconBtn({
  label,
  children,
  onClick,
  active,
  badge,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  badge?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`relative grid h-10 w-10 place-items-center rounded-full transition-all duration-300 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/60 ${
        active
          ? "bg-white/15 text-foreground ring-1 ring-white/20 backdrop-blur-xl shadow-inner"
          : "text-foreground/80 hover:bg-white/10 hover:text-foreground"
      }`}
      style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
    >
      {children}
      {badge && (
        <span className="pointer-events-none absolute top-1.5 right-1.5 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-lime opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-lime ring-2 ring-background" />
        </span>
      )}
    </button>
  );
}
