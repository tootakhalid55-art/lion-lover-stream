import { describe, expect, it } from "vitest";
import {
  browserContainerForSource,
  rewriteStreamUrl,
  type DeviceCapabilities,
} from "../device-playback";

const capabilities = (overrides: Partial<DeviceCapabilities>): DeviceCapabilities => ({
  isIOS: false,
  isAndroid: false,
  isSafari: false,
  isChromium: true,
  isFirefox: false,
  isMobile: false,
  hasMSE: true,
  nativeHLS: false,
  canPlayTs: false,
  preferredBrowserContainer: "ts",
  preferredExternalContainer: "ts",
  ...overrides,
});

describe("device playback selection", () => {
  it("uses the native MP4 proxy for MP4 movies on iPhone", () => {
    const target = browserContainerForSource(
      capabilities({ isIOS: true, isSafari: true, preferredBrowserContainer: "m3u8" }),
      "movie",
      "mp4",
    );
    const url = rewriteStreamUrl("/api/public/stream/movie/731.ts?sourceExt=mp4", target, "mp4");

    expect(target).toBe("mp4");
    expect(url).toBe("/api/public/stream/movie/731.mp4?sourceExt=mp4");
  });

  it("uses the provider M3U8 stream for live playback on iPhone", () => {
    expect(
      browserContainerForSource(
        capabilities({ isIOS: true, isSafari: true, preferredBrowserContainer: "m3u8" }),
        "live",
        "ts",
      ),
    ).toBe("m3u8");
  });

  it("uses the provider default TS stream for live playback with MSE", () => {
    const target = browserContainerForSource(capabilities({}), "live", "ts");
    const url = rewriteStreamUrl("/api/public/stream/live/731.m3u8", target, "ts");

    expect(target).toBe("ts");
    expect(url).toBe("/api/public/stream/live/731.ts?sourceExt=ts");
  });

  it("uses the native server MP4 stream for desktop browsers", () => {
    expect(browserContainerForSource(capabilities({}), "movie", "mp4")).toBe("mp4");
  });

  it("does not mislabel unsupported MKV files as MP4 on Safari", () => {
    expect(
      browserContainerForSource(
        capabilities({ isIOS: true, isSafari: true, preferredBrowserContainer: "m3u8" }),
        "movie",
        "mkv",
      ),
    ).toBe("m3u8");
  });
});
