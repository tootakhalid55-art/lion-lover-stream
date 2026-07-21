import type { ReactNode } from "react";

/** Frosted-glass popover container used by header dropdowns. */
export function GlassPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`absolute top-[calc(100%+10px)] left-0 z-40 origin-top glass-strong rounded-2xl motion-safe:animate-spring-in ${className}`}
      role="dialog"
    >
      {children}
    </div>
  );
}
