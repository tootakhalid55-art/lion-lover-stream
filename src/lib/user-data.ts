/**
 * Client-side user data: favorites + continue-watching + recents.
 *
 * Backed by localStorage under the `liontv:` namespace. Emits a window
 * event so multiple hooks stay in sync without a global store library.
 */
import { useEffect, useState, useCallback } from "react";
import { readJSON, writeJSON } from "./storage";
import type { Poster } from "@/services/api/types";

const FAV_KEY = "favorites";
const CW_KEY = "continue-watching";
const EVENT = "liontv:userdata";

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

// ─── Favorites ──────────────────────────────────────────────────────────

export interface FavItem {
  id: string;
  title: string;
  imageUrl?: string;
  gradient: string;
  year: string;
  rating?: number;
}

export function getFavorites(): FavItem[] {
  return readJSON<FavItem[]>(FAV_KEY, []);
}

export function isFavorite(id: string): boolean {
  return getFavorites().some((f) => f.id === id);
}

export function toggleFavorite(item: FavItem): boolean {
  const list = getFavorites();
  const exists = list.some((f) => f.id === item.id);
  const next = exists ? list.filter((f) => f.id !== item.id) : [item, ...list].slice(0, 200);
  writeJSON(FAV_KEY, next);
  emit();
  return !exists;
}

export function useFavorites(): FavItem[] {
  const [list, setList] = useState<FavItem[]>([]);
  useEffect(() => {
    const sync = () => setList(getFavorites());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return list;
}

export function useIsFavorite(id: string): [boolean, () => void] {
  const favs = useFavorites();
  const value = favs.some((f) => f.id === id);
  return [value, () => {}]; // toggle is caller-driven via toggleFavorite(item)
}

// ─── Continue Watching ──────────────────────────────────────────────────

export interface WatchProgress {
  id: string;
  title: string;
  imageUrl?: string;
  gradient: string;
  year: string;
  progress: number; // 0..1
  positionSec: number;
  durationSec: number;
  updatedAt: number;
}

export function getContinueWatching(): WatchProgress[] {
  return readJSON<WatchProgress[]>(CW_KEY, []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveProgress(entry: Omit<WatchProgress, "updatedAt">): void {
  const list = readJSON<WatchProgress[]>(CW_KEY, []);
  const next = [
    { ...entry, updatedAt: Date.now() },
    ...list.filter((x) => x.id !== entry.id),
  ].slice(0, 30);
  writeJSON(CW_KEY, next);
  emit();
}

export function removeProgress(id: string): void {
  const list = readJSON<WatchProgress[]>(CW_KEY, []);
  writeJSON(
    CW_KEY,
    list.filter((x) => x.id !== id),
  );
  emit();
}

export function useContinueWatching(): WatchProgress[] {
  const [list, setList] = useState<WatchProgress[]>([]);
  useEffect(() => {
    const sync = () => setList(getContinueWatching());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return list;
}

export function progressAsPoster(w: WatchProgress): Poster {
  return {
    id: w.id,
    title: w.title,
    year: w.year,
    imageUrl: w.imageUrl,
    gradient: w.gradient,
    progress: w.progress,
  };
}

// ─── ID helpers ─────────────────────────────────────────────────────────

export type Kind = "movie" | "series" | "live";

export function parseId(id: string): { kind: Kind; rawId: string } | null {
  const [kind, rawId] = id.split(":");
  if ((kind === "movie" || kind === "series" || kind === "live") && rawId) {
    return { kind, rawId };
  }
  return null;
}

export function detailPath(id: string): string {
  const p = parseId(id);
  if (!p) return "/";
  return `/${p.kind}/${p.rawId}`;
}

export function watchPath(id: string): string {
  const p = parseId(id);
  if (!p) return "/";
  return `/watch/${p.kind}/${p.rawId}`;
}

export function heroDetailPath(heroId: string): string {
  // hero id is "hero-movie:123" → "/movie/123"
  const inner = heroId.startsWith("hero-") ? heroId.slice(5) : heroId;
  return detailPath(inner);
}

export function heroWatchPath(heroId: string): string {
  const inner = heroId.startsWith("hero-") ? heroId.slice(5) : heroId;
  return watchPath(inner);
}
