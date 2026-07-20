/**
 * API composition root.
 *
 * The rest of the app imports `api` from here and never reaches into
 * `./mock`. To switch providers (staging, production, Supabase, GraphQL),
 * change only this file.
 */
import type { Api } from "./types";
import { mockApi } from "./mock";

export const api: Api = mockApi;
export type { Api } from "./types";
