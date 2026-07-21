/**
 * TEMPORARY debug endpoint — DEV ONLY. REMOVE BEFORE PRODUCTION.
 * Returns Xtream auth diagnostics without exposing the password.
 * Path is under /api/debug/* (not /api/public/*) so it still requires auth on published sites.
 */
import { createFileRoute } from "@tanstack/react-router";

function maskUser(u: string): string {
  if (!u) return "";
  if (u.length <= 4) return "*".repeat(u.length);
  return `${u.slice(0, 1)}${"*".repeat(u.length - 3)}${u.slice(-2)}`;
}

export const Route = createFileRoute("/api/debug/xtream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const probeMovie = url.searchParams.get("probeMovie");
        const { xtream, authenticate, callApi } = await import("@/lib/xtream.server");
        const { resolveCreds } = await import("@/lib/xtream-session.server");
        try {
          const { creds, isOverride } = await resolveCreds();
          const serverUrl = creds.serverUrl;
          const masked = maskUser(creds.username);
          const source = isOverride ? "user-override" : "default";

          let authOk = false;
          let userInfo: Record<string, unknown> = {};
          let serverInfo: Record<string, unknown> = {};
          let authError: string | undefined;
          try {
            const auth = await authenticate(creds);
            authOk = true;
            userInfo = auth.user_info as unknown as Record<string, unknown>;
            serverInfo = auth.server_info as unknown as Record<string, unknown>;
          } catch (e) {
            authError = e instanceof Error ? e.message : String(e);
          }

          // Also fetch raw player_api once to expose account fields not surfaced by authenticate()
          let rawAccount: Record<string, unknown> = {};
          try {
            const raw = await callApi<{ user_info?: Record<string, unknown> }>(creds);
            rawAccount = (raw?.user_info ?? {}) as Record<string, unknown>;
          } catch {
            /* ignore */
          }

          let liveCount = 0, movieCount = 0, seriesCount = 0;
          let sampleLive: number | undefined, sampleMovie: number | undefined, sampleSeries: number | undefined;
          if (authOk) {
            const [live, movies, series] = await Promise.all([
              xtream.getLiveStreams(creds).catch(() => []),
              xtream.getVodStreams(creds).catch(() => []),
              xtream.getSeriesList(creds).catch(() => []),
            ]);
            liveCount = live.length;
            movieCount = movies.length;
            seriesCount = series.length;
            sampleLive = live[0]?.stream_id;
            sampleMovie = movies[0]?.stream_id;
            sampleSeries = series[0]?.series_id;
          }

          const expRaw = (rawAccount.exp_date ?? (userInfo as Record<string, unknown>).exp_date) as unknown;
          const expDate = expRaw
            ? new Date(Number(expRaw) * 1000).toISOString()
            : null;

          return Response.json({
            warning: "DEV-ONLY endpoint — remove before production",
            serverUrl,
            usernameMasked: masked,
            credentialsSource: source,
            authenticationSuccessful: authOk,
            authError,
            accountStatus: (rawAccount.status ?? userInfo.status ?? null) as unknown,
            expirationDate: expDate,
            activeConnections: (rawAccount.active_cons ?? null) as unknown,
            maxConnections: (rawAccount.max_connections ?? null) as unknown,
            isTrial: (rawAccount.is_trial ?? null) as unknown,
            createdAt: rawAccount.created_at
              ? new Date(Number(rawAccount.created_at) * 1000).toISOString()
              : null,
            serverInfo,
            counts: { live: liveCount, movies: movieCount, series: seriesCount },
            sampleIds: { live: sampleLive, movie: sampleMovie, series: sampleSeries },
          });
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
