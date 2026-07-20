import type { ReactNode } from "react";

/** Frosted-glass popover container used by header dropdowns. */
export function GlassPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`absolute top-[calc(100%+8px)] left-0 z-40 origin-top rounded-2xl border border-white/10 bg-neutral-950/85 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.85)] backdrop-blur-2xl motion-safe:animate-scale-in ${className}`}
      role="dialog"
    >
      {children}
    </div>
  );
}
