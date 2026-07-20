/**
 * Simple in-memory TTL cache for Xtream responses.
 * Scope: per Worker instance (best-effort). Reduces upstream load and
 * speeds up hot paths (categories, lists, search corpora).
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const MAX_ENTRIES = 200;

function evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;
  // Drop oldest ~10%
  const drop = Math.ceil(MAX_ENTRIES * 0.1);
  const keys = Array.from(store.keys()).slice(0, drop);
  for (const k of keys) store.delete(k);
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;

  const flying = inflight.get(key) as Promise<T> | undefined;
  if (flying) return flying;

  const p = (async () => {
    try {
      const value = await loader();
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      evictIfNeeded();
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export function invalidate(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

/** Recommended TTLs (ms). */
export const TTL = {
  categories: 15 * 60_000,
  lists: 10 * 60_000,
  search: 5 * 60_000,
  detail: 30 * 60_000,
  health: 30_000,
} as const;
