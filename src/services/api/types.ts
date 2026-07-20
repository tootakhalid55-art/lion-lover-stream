/**
 * Central API contracts.
 *
 * Every UI feature depends on these interfaces — never on a concrete
 * implementation. The mock providers under `./mock/*` satisfy them today;
 * a future backend adapter (REST, GraphQL, Supabase) can replace them
 * without any UI changes.
 */

// ─── Domain types ────────────────────────────────────────────────────────

export type Badge =
  | "NEW"
  | "TOP10"
  | "HDR"
  | "DOLBY_VISION"
  | "DOLBY_ATMOS"
  | "4K";

export type Quality = "4K" | "HD";

export interface Poster {
  id: string;
  title: string;
  year: string;
  gradient: string;
  /** Optional real poster image URL from backend. Falls back to `gradient`. */
  imageUrl?: string;
  tag?: string;
  rating?: number;
  quality?: Quality;
  duration?: string;
  description?: string;
  badges?: Badge[];
  ageRating?: string;
  /** 0..1 fraction watched, present for Continue Watching entries */
  progress?: number;
  /** 1..10, present for Top 10 entries */
  rank?: number;
}

export interface Hero {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  gradient: string;
  /** Optional real backdrop image URL from backend. */
  imageUrl?: string;
  imdb: number;
  genres: string[];
  year: string;
  ageRating: string;
  /** Optional muted preview URL. UI falls back to the still image if absent. */
  previewUrl?: string;
}

export interface Row {
  id: string;
  title: string;
  items: Poster[];
  variant?: "poster" | "continue";
}

export interface HomeFeed {
  heroes: Hero[];
  continueWatching: Poster[];
  rows: Row[];
}

export interface Notification {
  id: number;
  title: string;
  body: string;
  unread: boolean;
  time: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email?: string;
  avatarSeed: string;
}

// ─── Repository interfaces ───────────────────────────────────────────────

export interface HomeRepository {
  getFeed(): Promise<HomeFeed>;
}

export interface CatalogRepository {
  getMovies(): Promise<Poster[]>;
  getSeries(): Promise<Poster[]>;
}

export interface SearchRepository {
  suggest(query: string, scope: "movies" | "series" | "all"): Promise<Poster[]>;
  trending(): Promise<string[]>;
}

export interface AuthRepository {
  getSession(): Promise<UserProfile | null>;
  signIn(email: string, password: string): Promise<UserProfile>;
  signOut(): Promise<void>;
}

export interface ContinueWatchingRepository {
  list(): Promise<Poster[]>;
  updateProgress(id: string, progress: number): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface FavoritesRepository {
  list(): Promise<string[]>;
  toggle(id: string): Promise<boolean>;
}

export interface NotificationsRepository {
  list(): Promise<Notification[]>;
  markAllRead(): Promise<void>;
}

export interface RecommendationsRepository {
  forUser(userId: string | null): Promise<Poster[]>;
}

export interface DownloadsRepository {
  list(): Promise<Poster[]>;
  enqueue(id: string): Promise<void>;
}

export interface PlaybackRepository {
  /** Resolve a play token / manifest URL for a given title. */
  resolve(titleId: string): Promise<{
    manifestUrl: string;
    protocol: "hls" | "dash";
    drm?: { type: "widevine" | "fairplay" | "playready"; licenseUrl: string };
    audioLanguages: string[];
    subtitleLanguages: string[];
  }>;
}

export interface SystemRepository {
  health(): Promise<{ ok: boolean; latencyMs: number; message?: string }>;
}

export interface Api {
  home: HomeRepository;
  catalog: CatalogRepository;
  search: SearchRepository;
  auth: AuthRepository;
  continueWatching: ContinueWatchingRepository;
  favorites: FavoritesRepository;
  notifications: NotificationsRepository;
  recommendations: RecommendationsRepository;
  downloads: DownloadsRepository;
  playback: PlaybackRepository;
  system?: SystemRepository;
}

