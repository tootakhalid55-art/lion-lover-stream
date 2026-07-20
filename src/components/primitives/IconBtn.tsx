import type { ReactNode } from "react";

/** Round 44×44 icon button with optional active/badge states. */
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
      className={`relative grid h-11 w-11 place-items-center rounded-full transition duration-200 hover:bg-white/10 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-nav-active ${
        active ? "bg-white/10 text-foreground" : "text-foreground/85"
      }`}
    >
      {children}
      {badge && (
        <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
        </span>
      )}
    </button>
  );
}
