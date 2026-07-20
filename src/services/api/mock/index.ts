/**
 * Mock implementation of the `Api` contract.
 *
 * Every method returns synchronously-resolved data so components can call
 * them exactly the same way they would a network client. Replace with a
 * fetch-based adapter to point at a real backend.
 */
import type { Api, Poster } from "../types";
import {
  continueWatching,
  heroes,
  newMovies,
  newSeries,
  notifications,
  trendingSearches,
} from "./data";

const ok = <T>(value: T): Promise<T> => Promise.resolve(value);

export const mockApi: Api = {
  home: {
    getFeed: () =>
      ok({
        heroes,
        continueWatching,
        rows: [
          { id: "row-movies", title: "أفلام جديدة", items: newMovies },
          { id: "row-series", title: "مسلسلات جديدة", items: newSeries },
        ],
      }),
  },
  catalog: {
    getMovies: () => ok(newMovies),
    getSeries: () => ok(newSeries),
  },
  search: {
    suggest: (q, scope) => {
      const pool: Poster[] =
        scope === "movies" ? newMovies : scope === "series" ? newSeries : [...newMovies, ...newSeries];
      const s = q.trim().toLowerCase();
      return ok(s ? pool.filter((p) => p.title.toLowerCase().includes(s)).slice(0, 6) : []);
    },
    trending: () => ok(trendingSearches),
  },
  auth: {
    getSession: () => ok(null),
    signIn: (email) => ok({ id: "u-mock", displayName: "أ", email, avatarSeed: "أ" }),
    signOut: () => ok(undefined),
  },
  continueWatching: {
    list: () => ok(continueWatching),
    updateProgress: () => ok(undefined),
    remove: () => ok(undefined),
  },
  favorites: {
    list: () => ok([]),
    toggle: () => ok(true),
  },
  notifications: {
    list: () => ok(notifications),
    markAllRead: () => ok(undefined),
  },
  recommendations: {
    forUser: () => ok([...newMovies.slice(0, 4), ...newSeries.slice(0, 4)]),
  },
  downloads: {
    list: () => ok([]),
    enqueue: () => ok(undefined),
  },
  playback: {
    resolve: (titleId) =>
      ok({
        manifestUrl: `https://placeholder.local/${titleId}/master.m3u8`,
        protocol: "hls" as const,
        audioLanguages: ["ar", "en"],
        subtitleLanguages: ["ar", "en"],
      }),
  },
};
