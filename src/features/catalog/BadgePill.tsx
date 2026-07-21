import type { Badge } from "@/services/api/types";

const MAP: Record<Badge, { label: string; className: string }> = {
  NEW: { label: "جديد", className: "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-[0_4px_12px_-2px_rgba(239,68,68,0.6)]" },
  TOP10: { label: "TOP 10", className: "bg-gradient-to-br from-lime to-lime/80 text-neutral-900 shadow-[0_4px_12px_-2px_color-mix(in_oklab,var(--lime)_50%,transparent)]" },
  HDR: { label: "HDR", className: "bg-white/10 text-foreground ring-1 ring-white/20 backdrop-blur-xl" },
  DOLBY_VISION: { label: "Dolby Vision", className: "bg-white/10 text-foreground ring-1 ring-white/20 backdrop-blur-xl" },
  DOLBY_ATMOS: { label: "Dolby Atmos", className: "bg-white/10 text-foreground ring-1 ring-white/20 backdrop-blur-xl" },
  "4K": { label: "4K", className: "bg-black/60 text-lime ring-1 ring-lime/40 backdrop-blur-xl" },
};

export function BadgePill({ kind }: { kind: Badge }) {
  const { label, className } = MAP[kind];
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black tracking-wider ${className}`}>
      {label}
    </span>
  );
}
