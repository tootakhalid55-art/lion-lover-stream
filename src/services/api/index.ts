/**
 * API composition root. Points at the live Xtream backend via server
 * functions. To fall back to mock data (offline dev), swap `xtreamApi`
 * for `mockApi` in this single file.
 */
import type { Api } from "./types";
import { xtreamApi } from "./xtream";
import { mockApi } from "./mock";

const DEV_MOCK_API =
  import.meta.env.DEV && import.meta.env.VITE_API_MODE === "mock";

export const api: Api = DEV_MOCK_API ? mockApi : xtreamApi;
export type { Api } from "./types";
