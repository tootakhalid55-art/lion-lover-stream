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

  const shouldUseMobileHls = () => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    const touchDevice = navigator.maxTouchPoints > 1;
    const mobileUa = /iP(hone|ad|od)|Android|Mobile|CriOS|FxiOS|EdgiOS/i.test(ua);
    return touchDevice || mobileUa;
  };

  const normalizePlayableSrc = (value: string) => {
    if (kind === "live") return value;
    try {
      const url = new URL(value, window.location.origin);
      const match = url.pathname.match(/\.([a-z0-9]+)$/i);
      const currentExt = match?.[1]?.toLowerCase() || ext || "mp4";
      if (!url.searchParams.get("sourceExt")) url.searchParams.set("sourceExt", currentExt === "m3u8" || currentExt === "ts" ? ext || "mp4" : currentExt);
      url.pathname = url.pathname.replace(/\.[a-z0-9]+$/i, shouldUseMobileHls() ? ".m3u8" : ".ts");
      return `${url.pathname}${url.search}`;
    } catch {
      return value;
    }
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
        console.error("[runtime:exception]", {
          filename: "src/routes/watch.$kind.$id.tsx",
          functionName: "WatchPage.useEffect:resolveStream",
          lineNumber: 27,
          message: err.message,
          stack: err.stack ?? null,
          requestUrl: window.location.href,
          httpStatus: null,
        });
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
    saveProgress({
      id: fullId,
      title: meta.title,
      imageUrl: meta.imageUrl,
      gradient: meta.gradient,
      year: meta.year,
      progress,
      positionSec: position,
      durationSec: duration,
    } as never);
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <button
          onClick={() => {
            if (window.history.length > 1) router.history.back();
            else router.navigate({ to: "/" });
          }}
          className="inline-flex items-center gap-1 text-sm text-foreground/70 hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" /> رجوع
        </button>
        <div className="mt-4">
          {error && <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-300 ring-1 ring-red-500/30">{error}</p>}
          {!error && !src && (
            <div className="aspect-video w-full animate-pulse rounded-2xl bg-white/5" />
          )}
          {src && (
            <Player
              src={src}
              poster={meta?.imageUrl}
              onProgress={handleProgress}
              onEnded={() => track({ name: "playback_completed", titleId: fullId })}
            />
          )}
        </div>
        {meta && <h1 className="mt-4 text-xl font-black text-foreground">{meta.title}</h1>}
        <Link to="/" className="mt-6 inline-block text-sm text-foreground/60 hover:text-foreground">العودة إلى الرئيسية</Link>
      </div>
    </div>
  );
}
