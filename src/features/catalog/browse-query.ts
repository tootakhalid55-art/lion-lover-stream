import { queryOptions } from "@tanstack/react-query";
import type { Poster } from "@/services/api/types";
import { getMovies, getSeries, getLive } from "@/lib/xtream.functions";

export type BrowseKind = "movies" | "series" | "live";

export function browseTitle(kind: BrowseKind): string {
  if (kind === "movies") return "الأفلام";
  if (kind === "series") return "المسلسلات";
  return "القنوات المباشرة";
}

function fetchBrowse(kind: BrowseKind): Promise<Poster[]> {
  if (kind === "movies") return getMovies();
  if (kind === "series") return getSeries();
  return getLive();
}

/** Cached list for a browse section. Kept fresh for 10 minutes. */
export function browseQueryOptions(kind: BrowseKind) {
  return queryOptions({
    queryKey: ["browse", kind] as const,
    queryFn: () => fetchBrowse(kind),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}
