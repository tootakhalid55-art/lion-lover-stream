/**
 * Xtream-backed implementation of the `Api` contract.
 * Delegates to server functions in `src/lib/xtream.functions.ts` so no
 * credentials, URLs, or upstream shapes leak into the client bundle.
 */
import type { Api } from "./types";
import {
  getHomeFeed,
  getMovies,
  getSeries,
  searchAll,
  resolveStream,
  getNotifications,
} from "@/lib/xtream.functions";

export const xtreamApi: Api = {
  home: { getFeed: () => getHomeFeed() },
  catalog: {
    getMovies: () => getMovies(),
    getSeries: () => getSeries(),
  },
  search: {
    suggest: (query, scope) => searchAll({ data: { query, scope } }),
    trending: () =>
      Promise.resolve(["أكشن", "دراما", "كوميدي", "أطفال", "وثائقي", "رياضة"]),
  },
  auth: {
    getSession: () => Promise.resolve(null),
    signIn: (email) =>
      Promise.resolve({ id: "u", displayName: email.slice(0, 1) || "أ", email, avatarSeed: "أ" }),
    signOut: () => Promise.resolve(),
  },
  continueWatching: {
    list: () => Promise.resolve([]),
    updateProgress: () => Promise.resolve(),
    remove: () => Promise.resolve(),
  },
  favorites: {
    list: () => Promise.resolve([]),
    toggle: () => Promise.resolve(true),
  },
  notifications: {
    list: () => getNotifications(),
    markAllRead: () => Promise.resolve(),
  },
  recommendations: {
    forUser: () => Promise.resolve([]),
  },
  downloads: {
    list: () => Promise.resolve([]),
    enqueue: () => Promise.resolve(),
  },
  playback: {
    resolve: async (titleId) => {
      const r = await resolveStream({ data: { id: titleId } });
      return { ...r };
    },
  },
};
