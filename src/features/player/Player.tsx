import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Video player. Uses native playback for MP4/HLS-on-Safari and hls.js
 * elsewhere for HLS manifests. Emits progress updates via `onProgress`.
 */
export function Player({
  src,
  poster,
  startAt,
  onProgress,
  onEnded,
}: {
  src: string;
  poster?: string;
  startAt?: number;
  onProgress?: (positionSec: number, durationSec: number) => void;
  onEnded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setLoading(true);

    const isHls = /\.m3u8($|\?)/i.test(src);
    let hls: import("hls.js").default | null = null;
    let cancelled = false;

    async function attach() {
      if (!video) return;
      if (isHls && !video.canPlayType("application/vnd.apple.mpegurl")) {
        try {
          const HlsMod = (await import("hls.js")).default;
          if (cancelled) return;
          if (HlsMod.isSupported()) {
            hls = new HlsMod({ enableWorker: true });
            hls.on(HlsMod.Events.ERROR, (_e, data) => {
              console.error("[player] hls error", data);
              if (data.fatal) setError("تعذر تشغيل البث");
            });
            hls.loadSource(src);
            hls.attachMedia(video);
          } else {
            setError("المتصفح لا يدعم HLS");
          }
        } catch (e) {
          console.error("[player] hls load failed", e);
          setError("فشل تحميل مشغل HLS");
        }
      } else {
        video.src = src;
      }
    }
    void attach();

    return () => {
      cancelled = true;
      hls?.destroy();
      if (video) video.removeAttribute("src");
    };
  }, [src]);

  const handleLoaded = () => {
    setLoading(false);
    const v = videoRef.current;
    if (v && startAt && startAt > 3 && startAt < (v.duration || Infinity) - 10) {
      v.currentTime = startAt;
    }
  };

  const handleTime = () => {
    const v = videoRef.current;
    if (!v || !v.duration || !isFinite(v.duration)) return;
    onProgress?.(v.currentTime, v.duration);
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
      <video
        ref={videoRef}
        poster={poster}
        controls
        autoPlay
        playsInline
        onLoadedMetadata={handleLoaded}
        onTimeUpdate={handleTime}
        onEnded={onEnded}
        onError={() => setError("تعذر تشغيل الفيديو")}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        crossOrigin="anonymous"
        className="h-full w-full bg-black"
      />
      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-nav-active" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center">
          <div>
            <p className="text-sm font-bold text-foreground">{error}</p>
            <p className="mt-1 text-xs text-foreground/70">جرّب مرة أخرى بعد قليل</p>
          </div>
        </div>
      )}
    </div>
  );
}
