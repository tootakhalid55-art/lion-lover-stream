/**
 * Safe localStorage helpers.
 *
 * All app storage lives under the `liontv:` namespace so cohabiting apps
 * on the same origin do not collide. Every call swallows exceptions —
 * private-mode Safari and disabled storage still let the UI render.
 */
const PREFIX = "liontv:";

export function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage disabled — ignore */
  }
}
