import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

/**
 * Video player. Uses a three-layer strategy:
 * 1) MPEG-TS transmuxing through mpegts.js for Xtream VOD/episodes.
 * 2) Native HLS on Safari/iOS.
 * 3) hls.js/native video fallback for standard HLS/MP4 streams.
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
  const [currentSrc, setCurrentSrc] = useState(src);
  const triedTsFallback = useRef(false);
  const triedHlsFallback = useRef(false);
  const mpegtsSupported = useRef<boolean | null>(null);

  useEffect(() => {
    triedTsFallback.current = false;
    triedHlsFallback.current = false;
    setCurrentSrc(src);
  }, [src]);

  const deriveTsSource = (value: string) => {
    try {
      const url = new URL(value, window.location.origin);
      const match = url.pathname.match(/\.([a-z0-9]+)$/i);
      const ext = match?.[1]?.toLowerCase() || url.searchParams.get("sourceExt") || "mp4";
      if (!url.searchParams.get("sourceExt") && ext !== "ts" && ext !== "m3u8") {
        url.searchParams.set("sourceExt", ext);
      }
      url.pathname = url.pathname.replace(/\.[a-z0-9]+$/i, ".ts");
      return `${url.pathname}${url.search}`;
    } catch {
      return value;
    }
  };

  const deriveHlsSource = (value: string) => {
    try {
      const url = new URL(value, window.location.origin);
      const match = url.pathname.match(/\.([a-z0-9]+)$/i);
      const ext = match?.[1]?.toLowerCase() || "mp4";
      if (!url.searchParams.get("sourceExt") && ext !== "m3u8") url.searchParams.set("sourceExt", ext === "ts" ? "mp4" : ext);
      url.pathname = url.pathname.replace(/\.[a-z0-9]+$/i, ".m3u8");
      return `${url.pathname}${url.search}`;
    } catch {
      return value;
    }
  };

  const retryWithTsSource = () => {
    if (triedTsFallback.current || mpegtsSupported.current === false) return false;
    const next = deriveTsSource(currentSrc);
    if (next === currentSrc) return false;
    triedTsFallback.current = true;
    console.log("[player] retrying through MPEG-TS transmuxer", next);
    setError(null);
    setLoading(true);
    setCurrentSrc(next);
    return true;
  };

  const retryWithHlsSource = () => {
    if (triedHlsFallback.current) return false;
    const next = deriveHlsSource(currentSrc);
    if (next === currentSrc) return false;
    triedHlsFallback.current = true;
    console.log("[player] retrying through HLS fallback", next);
    setError(null);
    setLoading(true);
    setCurrentSrc(next);
    return true;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setLoading(true);

    const activeSrc = currentSrc;
    const isHls = /\.m3u8($|\?)/i.test(activeSrc);
    const isTs = /\.ts($|\?)/i.test(activeSrc);
    const isLive = /\/live\//i.test(activeSrc);
    const ua = navigator.userAgent;
    const isAppleNativeHls = /iP(hone|ad|od)/i.test(ua) || (/Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg/i.test(ua));
    const canPlayNativeHls = Boolean(video.canPlayType("application/vnd.apple.mpegurl")) || isAppleNativeHls;
    let hls: import("hls.js").default | null = null;
    let tsPlayer: { destroy: () => void; unload?: () => void; detachMediaElement?: () => void } | null = null;
    let cancelled = false;

    async function attachMpegTs(media: HTMLVideoElement) {
      try {
        const Mpegts = (await import("mpegts.js")).default;
        if (cancelled) return true;
        if (!Mpegts.isSupported()) {
          mpegtsSupported.current = false;
          return false;
        }
        mpegtsSupported.current = true;
        const player = Mpegts.createPlayer(
          { type: "mpegts", isLive, cors: true, url: activeSrc },
          {
            enableWorker: false,
            enableStashBuffer: !isLive,
            stashInitialSize: 384 * 1024,
            seekType: "range",
            rangeLoadZeroStart: true,
            lazyLoad: false,
            deferLoadAfterSourceOpen: false,
            autoCleanupSourceBuffer: true,
            autoCleanupMaxBackwardDuration: 60,
            autoCleanupMinBackwardDuration: 20,
          },
        );
        tsPlayer = player;
        player.on(Mpegts.Events.ERROR, (type: string, detail: string, info: unknown) => {
          console.error("[player] mpegts error", { type, detail, info });
          if (type === Mpegts.ErrorTypes.NETWORK_ERROR) {
            setError("تعذر الوصول للبث — الحساب قد يكون مستخدماً حالياً أو الخادم رفض الاتصال");
            return;
          }
          if (canPlayNativeHls && retryWithHlsSource()) return;
          setError("تعذر تشغيل ترميز هذا الملف داخل المتصفح");
        });
        player.attachMediaElement(media);
        player.load();
        const playResult = player.play();
        if (playResult && typeof playResult.catch === "function") {
          playResult.catch((playError: unknown) => {
            console.warn("[player] autoplay deferred", playError);
          });
        }
        console.log("[player] mpegts src", activeSrc);
        return true;
      } catch (e) {
        console.error("[player] mpegts load failed", e);
        return false;
      }
    }

    async function attach() {
      if (!video) return;

      if (isTs) {
        if (canPlayNativeHls) {
          // Safari/iOS cannot consume raw TS as a normal video src, but it can
          // play the same bytes through our one-segment HLS manifest.
          if (retryWithHlsSource()) return;
        }
        const attached = await attachMpegTs(video);
        if (cancelled || attached) return;
        setError("هذا المتصفح لا يدعم مشغل MPEG-TS المطلوب لهذا الملف");
        return;
      }

      if (isHls && !canPlayNativeHls) {
        try {
          const HlsMod = (await import("hls.js")).default;
          if (cancelled) return;
          if (HlsMod.isSupported()) {
            hls = new HlsMod({
              enableWorker: true,
              lowLatencyMode: false,
              manifestLoadingMaxRetry: 1,
              fragLoadingMaxRetry: 1,
              levelLoadingMaxRetry: 1,
              startFragPrefetch: false,
              maxBufferLength: 30,
            });
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
                } else if (retryWithTsSource()) {
                  return;
                } else {
                  setError(code ? `تعذر تشغيل البث (HTTP ${code})` : "تعذر تشغيل هذا الملف من الخادم");
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
      try { tsPlayer?.unload?.(); } catch { /* ignore */ }
      try { tsPlayer?.detachMediaElement?.(); } catch { /* ignore */ }
      try { tsPlayer?.destroy(); } catch { /* ignore */ }
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

    if (err && (err.code === 3 || err.code === 4) && /\.m3u8($|\?)/i.test(currentSrc) && retryWithTsSource()) {
      return;
    }

    const canPlayNativeHls = Boolean(v.canPlayType("application/vnd.apple.mpegurl"));
    if (err && (err.code === 3 || err.code === 4) && /\.ts($|\?)/i.test(currentSrc) && canPlayNativeHls && retryWithHlsSource()) {
      return;
    }

    const codes: Record<number, string> = {
      1: "تم إلغاء التحميل",
      2: "خطأ في الشبكة — قد يكون الحساب مستخدماً على جهاز آخر أو تم رفض الوصول",
      3: "تعذر تشغيل هذا الملف من الخادم — جارٍ تحسين التوافق لهذا النوع من الملفات",
      4: "تعذر تشغيل هذا الملف من الخادم — تم إخفاء خطأ المتصفح ومحاولة المسارات البديلة تلقائياً",
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
            <button
              type="button"
              onClick={() => {
                triedTsFallback.current = false;
                triedHlsFallback.current = false;
                setCurrentSrc(src);
                setError(null);
                setLoading(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-pill px-4 py-2 text-xs font-extrabold text-pill-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" /> إعادة المحاولة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
