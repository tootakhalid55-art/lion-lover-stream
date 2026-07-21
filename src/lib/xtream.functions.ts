/**
 * Server functions exposing the Xtream backend to the client.
 * All credentials stay server-side. Handler bodies are stripped from the
 * client bundle by the TanStack Start Vite plugin.
 */
import { createServerFn } from "@tanstack/react-start";
import type { Hero, HomeFeed, Notification, Poster } from "@/services/api/types";

async function logServerFunctionError(
  functionName: string,
  lineNumber: number,
  error: unknown,
  httpStatus?: number,
) {
  const { logServerDiagnostic } = await import("./runtime-diagnostics.server");
  logServerDiagnostic({
    filename: "src/lib/xtream.functions.ts",
    functionName,
    lineNumber,
    error,
    httpStatus,
  });
}

// ─── Mapping helpers ─────────────────────────────────────────────────────

const GRADIENTS = [
  "from-fuchsia-900 via-neutral-900 to-black",
  "from-amber-800 via-red-950 to-black",
  "from-cyan-900 via-slate-900 to-black",
  "from-emerald-900 via-neutral-900 to-black",
  "from-indigo-900 via-slate-900 to-black",
  "from-rose-900 via-neutral-900 to-black",
] as const;

function pickGradient(seed: number | string): string {
  const n = typeof seed === "number" ? seed : Array.from(String(seed)).reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[Math.abs(n) % GRADIENTS.length];
}

function toNumber(v: unknown, d = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : d;
}

function vodToPoster(v: import("./xtream.server").XtreamVod): Poster {
  const rating = toNumber(v.rating);
  return {
    id: `movie:${v.stream_id}`,
    title: v.name,
    year: v.year || (v.added ? new Date(Number(v.added) * 1000).getFullYear().toString() : ""),
    gradient: pickGradient(v.stream_id),
    imageUrl: v.stream_icon || undefined,
    rating: rating > 10 ? rating / 10 : rating || undefined,
    tag: v.container_extension?.toUpperCase(),
  };
}

function seriesToPoster(s: import("./xtream.server").XtreamSeries): Poster {
  const rating = toNumber(s.rating);
  return {
    id: `series:${s.series_id}`,
    title: s.name,
    year: s.releaseDate?.slice(0, 4) || "",
    gradient: pickGradient(s.series_id),
    imageUrl: s.cover || (s.backdrop_path && s.backdrop_path[0]) || undefined,
    rating: rating > 10 ? rating / 10 : rating || undefined,
    description: s.plot,
  };
}

function liveToPoster(l: import("./xtream.server").XtreamLive): Poster {
  return {
    id: `live:${l.stream_id}`,
    title: l.name,
    year: "LIVE",
    gradient: pickGradient(l.stream_id),
    imageUrl: l.stream_icon || undefined,
    tag: "LIVE",
  };
}

// ─── Server functions ────────────────────────────────────────────────────

export const getHomeFeed = createServerFn({ method: "GET" }).handler(async (): Promise<HomeFeed> => {
  const { xtream } = await import("./xtream.server");
  const { resolveCreds } = await import("./xtream-session.server");
  const { cached, TTL } = await import("./xtream-cache.server");
  try {
    const { creds, isOverride } = await resolveCreds();
    const scope = isOverride ? `u:${creds.username}` : "default";
    const [movies, series, live] = await Promise.all([
      cached(`${scope}:vod`, TTL.lists, () => xtream.getVodStreams(creds)),
      cached(`${scope}:series`, TTL.lists, () => xtream.getSeriesList(creds)),
      cached(`${scope}:live`, TTL.lists, () => xtream.getLiveStreams(creds)),
    ]);

    const recentMovies = [...movies]
      .sort((a, b) => toNumber(b.added) - toNumber(a.added))
      .slice(0, 24)
      .map(vodToPoster);
    const recentSeries = [...series]
      .sort((a, b) => toNumber(b.last_modified) - toNumber(a.last_modified))
      .slice(0, 24)
      .map(seriesToPoster);
    const topLive = live.slice(0, 24).map(liveToPoster);

    const heroPool = [...recentMovies.slice(0, 3), ...recentSeries.slice(0, 3)];
    const heroes: Hero[] = heroPool.slice(0, 5).map((p, i): Hero => ({
      id: `hero-${p.id}`,
      title: p.title,
      subtitle: p.description || "استمتع بأفضل المحتوى على ليون تي في.",
      badge: i === 0 ? "مميز اليوم" : "جديد",
      gradient: p.gradient,
      imageUrl: p.imageUrl,
      imdb: p.rating || 0,
      genres: [],
      year: p.year,
      ageRating: "+13",
    }));

    return {
      heroes,
      continueWatching: [],
      rows: [
        { id: "row-new-movies", title: "أفلام جديدة", items: recentMovies },
        { id: "row-new-series", title: "مسلسلات جديدة", items: recentSeries },
        { id: "row-live", title: "قنوات مباشرة", items: topLive },
      ],
    };
  } catch (err) {
    await logServerFunctionError("getHomeFeed", 115, err);
    throw err;
  }
});

export const getMovies = createServerFn({ method: "GET" }).handler(async (): Promise<Poster[]> => {
  const { xtream } = await import("./xtream.server");
  const { resolveCreds } = await import("./xtream-session.server");
  const { cached, TTL } = await import("./xtream-cache.server");
  try {
    const { creds, isOverride } = await resolveCreds();
    const scope = isOverride ? `u:${creds.username}` : "default";
    const list = await cached(`${scope}:vod`, TTL.lists, () => xtream.getVodStreams(creds));
    return list.slice(0, 200).map(vodToPoster);
  } catch (err) {
    await logServerFunctionError("getMovies", 130, err);
    throw err;
  }
});

export const getSeries = createServerFn({ method: "GET" }).handler(async (): Promise<Poster[]> => {
  const { xtream } = await import("./xtream.server");
  const { resolveCreds } = await import("./xtream-session.server");
  const { cached, TTL } = await import("./xtream-cache.server");
  try {
    const { creds, isOverride } = await resolveCreds();
    const scope = isOverride ? `u:${creds.username}` : "default";
    const list = await cached(`${scope}:series`, TTL.lists, () => xtream.getSeriesList(creds));
    return list.slice(0, 200).map(seriesToPoster);
  } catch (err) {
    await logServerFunctionError("getSeries", 144, err);
    throw err;
  }
});

export const getLive = createServerFn({ method: "GET" }).handler(async (): Promise<Poster[]> => {
  const { xtream } = await import("./xtream.server");
  const { resolveCreds } = await import("./xtream-session.server");
  const { cached, TTL } = await import("./xtream-cache.server");
  try {
    const { creds, isOverride } = await resolveCreds();
    const scope = isOverride ? `u:${creds.username}` : "default";
    const list = await cached(`${scope}:live`, TTL.lists, () => xtream.getLiveStreams(creds));
    return list.slice(0, 200).map(liveToPoster);
  } catch (err) {
    await logServerFunctionError("getLive", 158, err);
    throw err;
  }
});

/** Lightweight health probe for the client (cached 30s). */
export const getHealth = createServerFn({ method: "GET" }).handler(async (): Promise<{
  ok: boolean;
  latencyMs: number;
  message?: string;
}> => {
  try {
    const { healthCheck } = await import("./xtream.server");
    const { cached, TTL } = await import("./xtream-cache.server");
    const r = await cached("health", TTL.health, healthCheck);
    return {
      ok: r.ok,
      latencyMs: r.latencyMs,
      message: r.ok ? undefined : "الخادم غير متاح حالياً. جارٍ إعادة المحاولة…",
    };
  } catch (err) {
    await logServerFunctionError("getHealth", 164, err);
    return { ok: false, latencyMs: 0, message: err instanceof Error ? err.message : "تعذّر الاتصال بالخادم" };
  }
});


export const searchAll = createServerFn({ method: "POST" })
  .validator((d: { query: string; scope: "movies" | "series" | "all" }) => d)
  .handler(async ({ data }): Promise<Poster[]> => {
    const q = data.query.trim().toLowerCase();
    if (!q) return [];
    const { xtream } = await import("./xtream.server");
    const { resolveCreds } = await import("./xtream-session.server");
    const { cached, TTL } = await import("./xtream-cache.server");
    try {
      const { creds, isOverride } = await resolveCreds();
      const scope = isOverride ? `u:${creds.username}` : "default";
      const results: Poster[] = [];
      if (data.scope !== "series") {
        const movies = await cached(`${scope}:vod`, TTL.lists, () => xtream.getVodStreams(creds));
        results.push(
          ...movies.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 20).map(vodToPoster),
        );
      }
      if (data.scope !== "movies") {
        const series = await cached(`${scope}:series`, TTL.lists, () => xtream.getSeriesList(creds));
        results.push(
          ...series.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 20).map(seriesToPoster),
        );
      }
      if (data.scope === "all") {
        const live = await cached(`${scope}:live`, TTL.lists, () => xtream.getLiveStreams(creds));
        results.push(
          ...live.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 10).map(liveToPoster),
        );
      }
      return results.slice(0, 30);
    } catch (err) {
      await logServerFunctionError("searchAll", 211, err);
      throw err;
    }
  });


/** Resolve a stream URL for playback. Returns a URL to our own proxy so
 * credentials never leave the server. */
export const resolveStream = createServerFn({ method: "POST" })
  .validator((d: { id: string; ext?: string }) => d)
  .handler(async ({ data }): Promise<{
    manifestUrl: string;
    protocol: "hls" | "dash";
    audioLanguages: string[];
    subtitleLanguages: string[];
  }> => {
    try {
      const [kind, rawId] = data.id.split(":");
      if (!kind || !rawId) throw new Error("Invalid stream id");
      // VOD/episodes from this Xtream server are frequently MPEG-TS bytes even
      // when the advertised extension is mp4. Start those with the MPEG-TS
      // transport endpoint so the browser player can transmux through MSE in a
      // single upstream connection. Live streams stay on HLS.
      const sourceExt = (data.ext || "mp4").replace(/[^a-z0-9]/gi, "").toLowerCase() || "mp4";
      const query = kind === "live" ? "" : `?sourceExt=${encodeURIComponent(sourceExt)}`;
      const proxyPath =
        kind === "live"
          ? `/api/public/stream/live/${encodeURIComponent(rawId)}.m3u8`
          : kind === "series"
            ? `/api/public/stream/series/${encodeURIComponent(rawId)}.ts${query}`
            : `/api/public/stream/movie/${encodeURIComponent(rawId)}.ts${query}`;
      return {
        manifestUrl: proxyPath,
        protocol: "hls",
        audioLanguages: ["ar", "en"],
        subtitleLanguages: ["ar", "en"],
      };
    } catch (err) {
      await logServerFunctionError("resolveStream", 227, err);
      throw err;
    }
  });

// ─── Auth (per-user override) ────────────────────────────────────────────

export const getAccountInfo = createServerFn({ method: "GET" }).handler(async (): Promise<{
  isOverride: boolean;
  username: string | null;
  status: string | null;
  expiresAt: string | null;
}> => {
  const { authenticate } = await import("./xtream.server");
  const { resolveCreds } = await import("./xtream-session.server");
  try {
    const { creds, isOverride } = await resolveCreds();
    const info = await authenticate(creds);
    return {
      isOverride,
      username: info.user_info.username,
      status: info.user_info.status,
      expiresAt: info.user_info.exp_date
        ? new Date(Number(info.user_info.exp_date) * 1000).toISOString()
        : null,
    };
  } catch (err) {
    await logServerFunctionError("getAccountInfo", 265, err);
    throw err;
  }
});

export const signInWithOwnAccount = createServerFn({ method: "POST" })
  .validator((d: { username: string; password: string; serverUrl?: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const { authenticate } = await import("./xtream.server");
    const { setOverride } = await import("./xtream-session.server");
    const serverUrl = (data.serverUrl || process.env.XTREAM_SERVER_URL || "").replace(/\/+$/, "");
    if (!serverUrl) return { ok: false, error: "الخادم غير مُهيَّأ" };
    if (!data.username || !data.password) return { ok: false, error: "أدخل اسم المستخدم وكلمة المرور" };
    try {
      await authenticate({ serverUrl, username: data.username, password: data.password });
      await setOverride(data.username, data.password, serverUrl);
      return { ok: true };
    } catch (err) {
      await logServerFunctionError("signInWithOwnAccount", 282, err, 401);
      return { ok: false, error: "بيانات الدخول غير صحيحة" };
    }
  });

export const useDefaultAccount = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { clearOverride } = await import("./xtream-session.server");
    await clearOverride();
    return { ok: true };
  } catch (err) {
    await logServerFunctionError("useDefaultAccount", 287, err);
    return { ok: false };
  }
});

// ─── Notifications / Continue Watching stubs (no upstream equivalent) ───

export const getNotifications = createServerFn({ method: "GET" }).handler(
  async (): Promise<Notification[]> => {
    try {
      return [];
    } catch (err) {
      await logServerFunctionError("getNotifications", 295, err);
      return [];
    }
  },
);

// ─── Detail views ────────────────────────────────────────────────────────

export interface MovieDetail {
  id: string;
  title: string;
  year: string;
  gradient: string;
  imageUrl?: string;
  backdropUrl?: string;
  rating?: number;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  duration?: string;
  ext: string;
}

export const getMovieDetail = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }): Promise<MovieDetail | null> => {
    const [kind, raw] = data.id.split(":");
    if (kind !== "movie" || !raw) return null;
    const { xtream } = await import("./xtream.server");
    const { resolveCreds } = await import("./xtream-session.server");
    const { cached, TTL } = await import("./xtream-cache.server");
    try {
      const { creds, isOverride } = await resolveCreds();
      const scope = isOverride ? `u:${creds.username}` : "default";
      const streamId = Number(raw);
      const [info, list] = await Promise.all([
        cached(`${scope}:vod-info:${streamId}`, TTL.lists, () => xtream.getVodInfo(creds, streamId)),
        cached(`${scope}:vod`, TTL.lists, () => xtream.getVodStreams(creds)),
      ]);
      const listItem = list.find((v) => v.stream_id === streamId);
      const md = (info?.movie_data ?? {}) as Record<string, unknown>;
      const meta = (info?.info ?? {}) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : undefined);
      const arr = (v: unknown) => (Array.isArray(v) ? v : []);
      const rating = toNumber(meta.rating ?? listItem?.rating);
      const backdrops = arr(meta.backdrop_path);
      return {
        id: data.id,
        title: str(md.name) || listItem?.name || "بدون عنوان",
        year: str(meta.releasedate)?.slice(0, 4) || listItem?.year || "",
        gradient: pickGradient(streamId),
        imageUrl: str(meta.movie_image) || str(meta.cover_big) || listItem?.stream_icon,
        backdropUrl: typeof backdrops[0] === "string" ? backdrops[0] : undefined,
        rating: rating > 10 ? rating / 10 : rating || undefined,
        plot: str(meta.plot) || str(meta.description),
        cast: str(meta.cast) || str(meta.actors),
        director: str(meta.director),
        genre: str(meta.genre),
        duration: str(meta.duration),
        ext: str(md.container_extension) || listItem?.container_extension || "mp4",
      };
    } catch (err) {
      await logServerFunctionError("getMovieDetail", 355, err);
      throw err;
    }
  });

export interface Episode {
  id: string;
  title: string;
  season: number;
  episode: number;
  plot?: string;
  imageUrl?: string;
  duration?: string;
  ext: string;
}

export interface SeriesDetail {
  id: string;
  title: string;
  year: string;
  gradient: string;
  imageUrl?: string;
  backdropUrl?: string;
  rating?: number;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  seasons: { season: number; episodes: Episode[] }[];
}

export const getSeriesDetail = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }): Promise<SeriesDetail | null> => {
    const [kind, raw] = data.id.split(":");
    if (kind !== "series" || !raw) return null;
    const { xtream } = await import("./xtream.server");
    const { resolveCreds } = await import("./xtream-session.server");
    const { cached, TTL } = await import("./xtream-cache.server");
    try {
      const { creds, isOverride } = await resolveCreds();
      const scope = isOverride ? `u:${creds.username}` : "default";
      const seriesId = Number(raw);
      const [info, list] = await Promise.all([
        cached(`${scope}:series-info:${seriesId}`, TTL.lists, () => xtream.getSeriesInfo(creds, seriesId)),
        cached(`${scope}:series`, TTL.lists, () => xtream.getSeriesList(creds)),
      ]);
      const listItem = list.find((s) => s.series_id === seriesId);
      const meta = (info?.info ?? {}) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : undefined);
      const rating = toNumber(meta.rating ?? listItem?.rating);
      const backdrops = Array.isArray(meta.backdrop_path) ? meta.backdrop_path : [];
      const seasons: SeriesDetail["seasons"] = [];
      const epMap = info?.episodes ?? {};
      for (const [seasonKey, eps] of Object.entries(epMap)) {
        const season = Number(seasonKey);
        if (!Array.isArray(eps)) continue;
        const episodes: Episode[] = eps.map((e) => {
          const ep = e as Record<string, unknown>;
          const info = (ep.info ?? {}) as Record<string, unknown>;
          const epId = String(ep.id ?? "");
          return {
            id: `series:${epId}`,
            title: str(ep.title) || `الحلقة ${str(ep.episode_num) ?? ""}`,
            season,
            episode: Number(ep.episode_num ?? 0),
            plot: str(info.plot),
            imageUrl: str(info.movie_image) || str(ep.info && (ep.info as Record<string, unknown>).movie_image),
            duration: str(info.duration),
            ext: str(ep.container_extension) || "mp4",
          };
        });
        seasons.push({ season, episodes });
      }
      seasons.sort((a, b) => a.season - b.season);
      return {
        id: data.id,
        title: str(meta.name) || listItem?.name || "بدون عنوان",
        year: (str(meta.releaseDate) || listItem?.releaseDate || "").slice(0, 4),
        gradient: pickGradient(seriesId),
        imageUrl: str(meta.cover) || listItem?.cover,
        backdropUrl: typeof backdrops[0] === "string" ? backdrops[0] : undefined,
        rating: rating > 10 ? rating / 10 : rating || undefined,
        plot: str(meta.plot) || listItem?.plot,
        cast: str(meta.cast),
        director: str(meta.director),
        genre: str(meta.genre),
        seasons,
      };
    } catch (err) {
      await logServerFunctionError("getSeriesDetail", 445, err);
      throw err;
    }
  });

export const getLiveChannel = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }): Promise<Poster | null> => {
    const [kind, raw] = data.id.split(":");
    if (kind !== "live" || !raw) return null;
    const { xtream } = await import("./xtream.server");
    const { resolveCreds } = await import("./xtream-session.server");
    const { cached, TTL } = await import("./xtream-cache.server");
    try {
      const { creds, isOverride } = await resolveCreds();
      const scope = isOverride ? `u:${creds.username}` : "default";
      const list = await cached(`${scope}:live`, TTL.lists, () => xtream.getLiveStreams(creds));
      const item = list.find((l) => l.stream_id === Number(raw));
      return item ? liveToPoster(item) : null;
    } catch (err) {
      await logServerFunctionError("getLiveChannel", 465, err);
      throw err;
    }
  });
