import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Video player. Uses native playback for MP4/HLS-on-Safari and hls.js
 * elsewhere for HLS manifests. Emits progress updates via `onProgress`.
 *
 * If the browser reports an unsupported codec (MediaError.code = 4) for a
 * direct MP4/MKV stream, we automatically retry with an `.m3u8` variant so
 * the Xtream server can transcode to a browser-friendly HLS stream.
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
  // Effective src (may be swapped to an .m3u8 fallback after codec failure).
  const [currentSrc, setCurrentSrc] = useState(src);
  const triedHlsFallback = useRef(false);

  useEffect(() => {
    triedHlsFallback.current = false;
    setCurrentSrc(src);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setLoading(true);

    const activeSrc = currentSrc;
    const isHls = /\.m3u8($|\?)/i.test(activeSrc);
    let hls: import("hls.js").default | null = null;
    let cancelled = false;

    async function attach() {
      if (!video) return;

      if (isHls && !video.canPlayType("application/vnd.apple.mpegurl")) {
        try {
          const HlsMod = (await import("hls.js")).default;
          if (cancelled) return;
          if (HlsMod.isSupported()) {
            hls = new HlsMod({ enableWorker: true, lowLatencyMode: false });
            hls.on(HlsMod.Events.ERROR, (_e, data) => {
              console.error("[player] hls error", {
                type: data.type,
                details: data.details,
                fatal: data.fatal,
                response: data.response,
              });
              if (data.fatal) {
                const code = data.response?.code;
                if (code === 401 || code === 403) {
                  setError("غير مصرح — الحساب مستخدم على جهاز آخر أو انتهت صلاحيته. أغلق أي جلسة مفتوحة وحاول مجدداً.");
                } else {
                  setError(code ? `تعذر تشغيل البث (HTTP ${code})` : `تعذر تشغيل البث — ${data.details}`);
                }
              }
            });
            hls.loadSource(activeSrc);
            hls.attachMedia(video);
          } else {
            setError("المتصفح لا يدعم HLS");
          }
        } catch (e) {
          console.error("[player] hls load failed", e);
          setError("فشل تحميل مشغل HLS");
        }
      } else {
        console.log("[player] native src", activeSrc);
        video.src = activeSrc;
        video.load();
      }
    }
    void attach();

    return () => {
      cancelled = true;
      hls?.destroy();
      if (video) {
        // Detach without firing an error event.
        video.removeAttribute("src");
        try { video.load(); } catch { /* ignore */ }
      }
    };
  }, [currentSrc]);

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

  const handleVideoError = () => {
    const v = videoRef.current;
    // Ignore errors from cleanup (src removed).
    if (!v || !v.currentSrc) return;
    const err = v.error;
    console.error("[player] video error", { code: err?.code, message: err?.message, src: v.currentSrc });

    // Auto-fallback: if the browser can't decode the direct MP4/MKV,
    // ask the Xtream server for a transcoded HLS variant.
    if (
      err &&
      (err.code === 3 || err.code === 4) &&
      !triedHlsFallback.current &&
      !/\.m3u8($|\?)/i.test(currentSrc)
    ) {
      triedHlsFallback.current = true;
      const hlsSrc = currentSrc.replace(/\.(mp4|mkv|avi|m4v)(\?|$)/i, ".m3u8$2");
      if (hlsSrc !== currentSrc) {
        console.log("[player] codec unsupported — retrying via HLS transcode", hlsSrc);
        setError(null);
        setLoading(true);
        setCurrentSrc(hlsSrc);
        return;
      }
    }

    const codes: Record<number, string> = {
      1: "تم إلغاء التحميل",
      2: "خطأ في الشبكة — قد يكون الحساب مستخدماً على جهاز آخر أو تم رفض الوصول",
      3: "تعذر فك ترميز الفيديو — قد يكون الترميز غير مدعوم على هذا الجهاز",
      4: "التنسيق غير مدعوم من المتصفح — جرّب فتحه على جهاز آخر أو استخدم تطبيقاً مثل VLC",
    };
    const msg = err ? codes[err.code] || `خطأ ${err.code}` : "تعذر تشغيل الفيديو";
    setError(msg);
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
        onError={handleVideoError}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        className="h-full w-full bg-black"
      />
      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-nav-active" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center">
          <div>
            <p className="text-sm font-bold text-foreground">{error}</p>
            <p className="mt-1 text-xs text-foreground/70">جرّب مرة أخرى بعد قليل</p>
          </div>
        </div>
      )}
    </div>
  );
}
