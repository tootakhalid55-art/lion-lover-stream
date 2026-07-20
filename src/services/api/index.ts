/**
 * API composition root. Points at the live Xtream backend via server
 * functions. To fall back to mock data (offline dev), swap `xtreamApi`
 * for `mockApi` in this single file.
 */
import type { Api } from "./types";
import { xtreamApi } from "./xtream";

export const api: Api = xtreamApi;
export type { Api } from "./types";
