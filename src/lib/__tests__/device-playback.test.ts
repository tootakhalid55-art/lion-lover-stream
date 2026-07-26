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

  it("keeps live playback on HLS", () => {
    expect(
      browserContainerForSource(
        capabilities({ isIOS: true, isSafari: true, preferredBrowserContainer: "m3u8" }),
        "live",
        "mp4",
      ),
    ).toBe("m3u8");
  });

  it("keeps MPEG-TS transmuxing for desktop browsers", () => {
    expect(browserContainerForSource(capabilities({}), "movie", "mp4")).toBe("ts");
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
