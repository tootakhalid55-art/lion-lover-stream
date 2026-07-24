// Automatic device/browser compatibility detection for streaming playback.
// Chooses the best in-browser container (HLS vs MPEG-TS) and the best URL
// variant for external native players (VLC / MX Player).

export type PlaybackContainer = "m3u8" | "ts" | "mp4";

export interface DeviceCapabilities {
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChromium: boolean;
  isFirefox: boolean;
  isMobile: boolean;
  hasMSE: boolean;
  nativeHLS: boolean;
  canPlayTs: boolean;
  /** Best container for the built-in <video> player + JS shims. */
  preferredBrowserContainer: PlaybackContainer;
  /** Best URL variant to hand off to native mobile players. */
  preferredExternalContainer: PlaybackContainer;
}

let cached: DeviceCapabilities | null = null;

export function detectDeviceCapabilities(): DeviceCapabilities {
  if (cached) return cached;
  if (typeof window === "undefined") {
    return {
      isIOS: false, isAndroid: false, isSafari: false, isChromium: false, isFirefox: false,
      isMobile: false, hasMSE: false, nativeHLS: false, canPlayTs: false,
      preferredBrowserContainer: "m3u8", preferredExternalContainer: "ts",
    };
  }
  const ua = navigator.userAgent || "";
  const isIOS = /iP(hone|ad|od)/i.test(ua)
    || (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(ua);
  const isChromium = /Chrome|CriOS|Edg|OPR/i.test(ua);
  const isFirefox = /Firefox|FxiOS/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile/i.test(ua);

  const hasMSE = typeof (window as unknown as { MediaSource?: unknown }).MediaSource !== "undefined";

  const video = document.createElement("video");
  const nativeHLS = !!video.canPlayType("application/vnd.apple.mpegurl")
    || !!video.canPlayType("application/x-mpegURL");
  const canPlayTs = !!video.canPlayType("video/mp2t")
    || !!video.canPlayType('video/mp2t; codecs="avc1.42E01E,mp4a.40.2"');

  // iOS / Safari can only play HLS natively (no MSE for HLS on iOS Safari).
  // Android Chrome + desktop Chromium/Firefox get MPEG-TS via mpegts.js (MSE),
  // which handles the .ts container the upstream Xtream server delivers.
  let preferredBrowserContainer: PlaybackContainer;
  if (isIOS || nativeHLS) preferredBrowserContainer = "m3u8";
  else if (hasMSE) preferredBrowserContainer = "ts";
  else preferredBrowserContainer = "m3u8";

  // Native mobile players (VLC/MX) do best with the raw .ts stream — HLS
  // playlists are supported but add unnecessary indirection over cellular.
  const preferredExternalContainer: PlaybackContainer = isMobile ? "ts" : "ts";

  cached = {
    isIOS, isAndroid, isSafari, isChromium, isFirefox, isMobile,
    hasMSE, nativeHLS, canPlayTs,
    preferredBrowserContainer, preferredExternalContainer,
  };
  return cached;
}

/**
 * Rewrite a proxied stream URL to a target container, preserving the original
 * upstream extension in `sourceExt` so the backend transcoder knows what to do.
 */
export function rewriteStreamUrl(rawSrc: string, targetExt: PlaybackContainer, fallbackSourceExt?: string): string {
  try {
    const url = new URL(rawSrc, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const match = url.pathname.match(/\.([a-z0-9]+)$/i);
    const currentExt = match?.[1]?.toLowerCase();
    const sourceExt = url.searchParams.get("sourceExt")
      || (currentExt && currentExt !== "m3u8" && currentExt !== "ts" ? currentExt : (fallbackSourceExt || "mp4"));
    url.searchParams.set("sourceExt", sourceExt);
    url.pathname = url.pathname.replace(/\.[a-z0-9]+$/i, `.${targetExt}`);
    // Return path+search (relative) when the input was relative — keeps SSR-safe.
    if (!/^https?:\/\//i.test(rawSrc)) return `${url.pathname}${url.search}`;
    return url.toString();
  } catch {
    return rawSrc;
  }
}

/**
 * One-shot helper: pick the best container for this device and rewrite the URL.
 */
export function adaptStreamUrlForDevice(rawSrc: string, kind: "movie" | "series" | "live" | string, fallbackSourceExt?: string): string {
  if (kind === "live") return rawSrc;
  const caps = detectDeviceCapabilities();
  return rewriteStreamUrl(rawSrc, caps.preferredBrowserContainer, fallbackSourceExt);
}
