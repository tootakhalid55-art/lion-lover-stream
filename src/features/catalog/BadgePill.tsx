import type { Badge } from "@/services/api/types";

const MAP: Record<Badge, { label: string; className: string }> = {
  NEW: { label: "جديد", className: "bg-red-500 text-white" },
  TOP10: { label: "TOP 10", className: "bg-nav-active text-neutral-900" },
  HDR: { label: "HDR", className: "bg-white/15 text-foreground ring-1 ring-white/20" },
  DOLBY_VISION: { label: "Dolby Vision", className: "bg-white/15 text-foreground ring-1 ring-white/20" },
  DOLBY_ATMOS: { label: "Dolby Atmos", className: "bg-white/15 text-foreground ring-1 ring-white/20" },
  "4K": { label: "4K", className: "bg-black/60 text-nav-active ring-1 ring-nav-active/40" },
};

export function BadgePill({ kind }: { kind: Badge }) {
  const { label, className } = MAP[kind];
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black tracking-wider backdrop-blur ${className}`}>
      {label}
    </span>
  );
}
