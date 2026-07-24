import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Player } from "@/features/player/Player";
import { resolveStream, getMovieDetail, getLiveChannel } from "@/lib/xtream.functions";
import { saveProgress } from "@/lib/user-data";
import { track } from "@/lib/analytics";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/watch/$kind/$id")({
  validateSearch: (s: Record<string, unknown>) => ({ ext: typeof s.ext === "string" ? s.ext : undefined }),
  component: WatchPage,
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} filename="src/routes/watch.$kind.$id.tsx" functionName="WatchPage" lineNumber={23} />
  ),
});

function WatchPage() {
  const { kind, id } = Route.useParams();
  const { ext } = Route.useSearch();
  const router = useRouter();
  const fullId = `${kind}:${id}`;
  const [src, setSrc] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ title: string; imageUrl?: string; gradient: string; year: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizePlayableSrc = (value: string) => {
    if (kind === "live") return value;
    try {
      const url = new URL(value, window.location.origin);
      const match = url.pathname.match(/\.([a-z0-9]+)$/i);
      const currentExt = match?.[1]?.toLowerCase() || ext || "mp4";
      if (!url.searchParams.get("sourceExt")) url.searchParams.set("sourceExt", currentExt === "m3u8" || currentExt === "ts" ? ext || "mp4" : currentExt);
      url.pathname = url.pathname.replace(/\.[a-z0-9]+$/i, ".ts");
      return `${url.pathname}${url.search}`;
    } catch { return value; }
  };

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await resolveStream({ data: { id: fullId, ext } });
        if (!alive) return;
        setSrc(normalizePlayableSrc(r.manifestUrl));
        track({ name: "playback_started", titleId: fullId });
        if (kind === "movie") {
          const m = await getMovieDetail({ data: { id: fullId } });
          if (alive && m) setMeta({ title: m.title, imageUrl: m.imageUrl, gradient: m.gradient, year: m.year });
        } else if (kind === "live") {
          const l = await getLiveChannel({ data: { id: fullId } });
          if (alive && l) setMeta({ title: l.title, imageUrl: l.imageUrl, gradient: l.gradient, year: l.year });
        } else {
          setMeta({ title: "حلقة", gradient: "from-neutral-800 to-black", year: "" });
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        console.error("[runtime:exception]", { filename: "src/routes/watch.$kind.$id.tsx", functionName: "WatchPage.useEffect:resolveStream", lineNumber: 27, message: err.message, stack: err.stack ?? null, requestUrl: window.location.href, httpStatus: null });
        if (alive) setError(err.message);
      }
    }
    void load();
    return () => { alive = false; };
  }, [fullId, kind, ext]);

  const handleProgress = (position: number, duration: number) => {
    if (!meta || kind === "live" || !duration) return;
    const progress = position / duration;
    if (progress < 0.02 || progress > 0.98) return;
    saveProgress({ id: fullId, title: meta.title, imageUrl: meta.imageUrl, gradient: meta.gradient, year: meta.year, progress, positionSec: position, durationSec: duration } as never);
  };

  return (
    <div className="min-h-dvh bg-black">
      <div className="mx-auto max-w-7xl px-4 py-5">
        <button
          onClick={() => { if (window.history.length > 1) router.history.back(); else router.navigate({ to: "/" }); }}
          className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-bold text-foreground/90 hover:bg-white/15 transition"
        >
          <ArrowRight className="h-3.5 w-3.5" /> رجوع
        </button>
        <div className="mt-4">
          {error && (
            <div className="rounded-2xl bg-red-500/10 p-5 text-sm text-red-200 ring-1 ring-red-500/40 backdrop-blur-xl">
              <p className="font-bold">تعذّر تشغيل المحتوى</p>
              <p className="mt-1 text-red-300/90 text-xs">{error}</p>
            </div>
          )}
          {!error && !src && (
            <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-black ring-1 ring-white/10">
              <div className="absolute inset-0 skeleton" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="flex items-center gap-3 rounded-full glass px-4 py-2 text-xs text-foreground/80">
                  <span className="h-2 w-2 rounded-full bg-lime motion-safe:animate-pulse" />
                  جاري تجهيز البث…
                </div>
              </div>
            </div>
          )}
          {src && (
            <div className="overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
              <Player src={src} poster={meta?.imageUrl} onProgress={handleProgress} onEnded={() => track({ name: "playback_completed", titleId: fullId })} />
            </div>
          )}
          {src && <ExternalPlayerLinks src={src} title={meta?.title} />}
        </div>
        {meta && (
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black text-foreground">{meta.title}</h1>
              {meta.year && <p className="text-xs text-foreground/60">{meta.year}</p>}
            </div>
            <Link to="/" className="shrink-0 text-xs text-foreground/60 hover:text-lime transition">العودة إلى الرئيسية</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ExternalPlayerLinks({ src, title }: { src: string; title?: string }) {
  const absUrl = (() => {
    try { return /^https?:\/\//i.test(src) ? src : new URL(src, window.location.origin).toString(); }
    catch { return src; }
  })();
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iP(hone|ad|od)/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const encoded = encodeURIComponent(absUrl);
  const encodedTitle = encodeURIComponent(title || "Nova TV");

  const vlcIos = `vlc-x-callback://x-callback-url/stream?url=${encoded}`;
  const vlcAndroid = `intent:${absUrl}#Intent;package=org.videolan.vlc;type=video/*;S.title=${encodedTitle};end`;
  const mxAndroid = `intent:${absUrl}#Intent;package=com.mxtech.videoplayer.ad;type=video/*;S.title=${encodedTitle};end`;
  const mxProAndroid = `intent:${absUrl}#Intent;package=com.mxtech.videoplayer.pro;type=video/*;S.title=${encodedTitle};end`;

  const btn = "inline-flex items-center gap-1.5 rounded-full glass px-4 py-2 text-xs font-bold text-foreground/90 hover:bg-white/15 transition";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-xs text-foreground/60">فتح في مشغل الهاتف:</span>
      {isIOS && <a href={vlcIos} className={btn}>VLC</a>}
      {isAndroid && (
        <>
          <a href={vlcAndroid} className={btn}>VLC</a>
          <a href={mxAndroid} className={btn}>MX Player</a>
          <a href={mxProAndroid} className={btn}>MX Pro</a>
        </>
      )}
      {!isIOS && !isAndroid && <a href={absUrl} target="_blank" rel="noreferrer" className={btn}>فتح الرابط المباشر</a>}
      <button
        type="button"
        onClick={() => { void navigator.clipboard?.writeText(absUrl); }}
        className={btn}
      >
        نسخ الرابط
      </button>
    </div>
  );
}
      </div>
    </div>
  );
}
