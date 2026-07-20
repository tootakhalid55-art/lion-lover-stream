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

    // Pre-flight the proxy so we can report the real HTTP status.
    async function preflight(): Promise<string | null> {
      try {
        const r = await fetch(src, { method: "GET", headers: { range: "bytes=0-1" } });
        console.log("[player] preflight", { url: src, status: r.status, type: r.headers.get("content-type") });
        if (r.status === 401 || r.status === 403) return "غير مصرح — انتهت صلاحية الحساب أو تم رفض الوصول";
        if (r.status === 404) return "الملف غير موجود على الخادم";
        if (r.status === 429) return "تم تجاوز الحد المسموح، حاول لاحقًا";
        if (r.status === 502 || r.status === 503 || r.status === 504) return "الخادم غير متاح حالياً";
        if (r.status >= 400 && r.status !== 206 && r.status !== 200) {
          const body = await r.text().catch(() => "");
          return `تعذر جلب البث (HTTP ${r.status})${body ? ` — ${body.slice(0, 120)}` : ""}`;
        }
        return null;
      } catch (e) {
        console.error("[player] preflight failed", e);
        return "تعذر الاتصال بخادم البث";
      }
    }

    async function attach() {
      if (!video) return;
      const preErr = await preflight();
      if (cancelled) return;
      if (preErr) {
        setError(preErr);
        setLoading(false);
        return;
      }

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
                setError(code ? `تعذر تشغيل البث (HTTP ${code})` : `تعذر تشغيل البث — ${data.details}`);
              }
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
        console.log("[player] native src", src);
        video.src = src;
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

  const handleVideoError = () => {
    const v = videoRef.current;
    // Ignore errors from cleanup (src removed).
    if (!v || !v.currentSrc) return;
    const err = v.error;
    const codes: Record<number, string> = {
      1: "تم إلغاء التحميل",
      2: "خطأ في الشبكة أثناء التشغيل",
      3: "تعذر فك ترميز الفيديو",
      4: "التنسيق غير مدعوم من المتصفح",
    };
    const msg = err ? codes[err.code] || `خطأ ${err.code}` : "تعذر تشغيل الفيديو";
    console.error("[player] video error", { code: err?.code, message: err?.message, src: v.currentSrc });
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
