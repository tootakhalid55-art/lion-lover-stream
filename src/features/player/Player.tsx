import type { PlaybackEvents, PlayerSource } from "./types";

/**
 * Player placeholder.
 *
 * Renders a poster + play button so surrounding UI can be developed
 * without a real streaming backend. Replace the body of this component
 * with a Shaka/hls.js integration; keep the prop shape stable so callers
 * don't change.
 */
export function Player(_props: { source: PlayerSource; events?: PlaybackEvents; poster?: string }) {
  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-950 ring-1 ring-white/10"
      role="region"
      aria-label="مشغل الفيديو"
    >
      <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
        سيتم توصيل المشغّل بمصدر البث قريبًا
      </div>
    </div>
  );
}
