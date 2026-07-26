import { describe, expect, it } from "vitest";
import {
  buildServerStreamPath,
  normalizeSourceExtension,
  serverPlaybackContainerForSource,
} from "../stream-playback";

describe("server playback routing", () => {
  it("uses the provider HLS endpoint for live channels", () => {
    expect(serverPlaybackContainerForSource("live", "ts")).toBe("m3u8");
    expect(buildServerStreamPath("live", "731", "ts")).toBe("/api/public/stream/live/731.m3u8");
  });

  it("uses the native server-proxied MP4 endpoint for movies", () => {
    expect(serverPlaybackContainerForSource("movie", "mp4")).toBe("mp4");
    expect(buildServerStreamPath("movie", "731", "mp4")).toBe(
      "/api/public/stream/movie/731.mp4?sourceExt=mp4",
    );
  });

  it("preserves the provider's native MOV extension for episodes", () => {
    expect(buildServerStreamPath("series", "88", "mov")).toBe(
      "/api/public/stream/series/88.mov?sourceExt=mov",
    );
  });

  it("preserves the provider's MKV extension instead of relabeling it as TS", () => {
    expect(buildServerStreamPath("movie", "90", "mkv")).toBe(
      "/api/public/stream/movie/90.mkv?sourceExt=mkv",
    );
  });

  it("keeps transport streams on the server TS endpoint", () => {
    expect(serverPlaybackContainerForSource("series", "ts")).toBe("ts");
    expect(buildServerStreamPath("series", "99", "TS")).toBe(
      "/api/public/stream/series/99.ts?sourceExt=ts",
    );
  });

  it("sanitizes source extensions before adding them to a server URL", () => {
    expect(normalizeSourceExtension("../MP4?token=bad")).toBe("mp4tokenbad");
  });
});
