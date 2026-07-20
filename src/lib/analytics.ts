/**
 * Minimal event bus for product analytics.
 *
 * Components emit typed events via `track(...)`. Wire real providers
 * (PostHog, Amplitude, Segment) by adding a subscriber in `bootstrap()`.
 * Until then events log to console in dev and are silent in production.
 */

export type AnalyticsEvent =
  | { name: "home_viewed" }
  | { name: "hero_interacted"; heroId: string; action: "play" | "add_list" | "remove_list" | "info" | "dot" | "swipe" }
  | { name: "poster_clicked"; posterId: string; row: string }
  | { name: "favorite_toggled"; posterId: string; value: boolean }
  | { name: "continue_watching_resumed"; posterId: string }
  | { name: "search_used"; query: string; scope: string }
  | { name: "search_committed"; term: string }
  | { name: "playback_started"; titleId: string }
  | { name: "playback_progress"; titleId: string; progress: number }
  | { name: "playback_completed"; titleId: string }
  | { name: "navigation_tabbed"; tab: string }
  | { name: "notification_opened"; id: number };

type Handler = (event: AnalyticsEvent) => void;

const handlers = new Set<Handler>();

export function subscribe(handler: Handler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function track(event: AnalyticsEvent): void {
  handlers.forEach((h) => {
    try {
      h(event);
    } catch (err) {
      // Never let a broken subscriber crash the app.
      console.error("analytics handler failed", err);
    }
  });
}

/** Optional dev-mode logging subscriber. Call once from app bootstrap. */
export function bootstrap(): void {
  if (import.meta.env.DEV) {
    subscribe((e) => console.debug("[analytics]", e));
  }
}
