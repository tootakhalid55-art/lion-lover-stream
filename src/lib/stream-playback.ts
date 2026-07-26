export type ServerPlaybackContainer = "m3u8" | "ts" | "mp4";

const NATIVE_VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "mov"]);

export function normalizeSourceExtension(sourceExt?: string): string {
  return (
    String(sourceExt || "mp4")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase() || "mp4"
  );
}

export function serverPlaybackContainerForSource(
  kind: string,
  sourceExt?: string,
): ServerPlaybackContainer {
  if (kind === "live") return "m3u8";
  return NATIVE_VIDEO_EXTENSIONS.has(normalizeSourceExtension(sourceExt)) ? "mp4" : "ts";
}

export function buildServerStreamPath(kind: string, rawId: string, sourceExt?: string): string {
  const id = encodeURIComponent(rawId);
  if (kind === "live") return `/api/public/stream/live/${id}.m3u8`;

  // Preserve the provider's advertised file extension. This was the original
  // working playback path before VOD was forced through synthetic HLS/TS.
  const mediaKind = kind === "series" ? "series" : "movie";
  const normalizedExt = normalizeSourceExtension(sourceExt);
  return `/api/public/stream/${mediaKind}/${id}.${normalizedExt}?sourceExt=${encodeURIComponent(normalizedExt)}`;
}
