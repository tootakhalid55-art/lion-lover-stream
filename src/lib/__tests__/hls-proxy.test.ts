import { describe, expect, it } from "vitest";
import { extractXtreamMediaPath, rewriteHlsManifest } from "../hls-proxy";

const options = {
  kind: "live" as const,
  streamId: "731",
  sourceExt: "ts",
  manifestUrl: "http://provider.example:8080/live/demo-user/demo-pass/731.m3u8",
  username: "demo-user",
  password: "demo-pass",
};

describe("HLS proxy rewriting", () => {
  it("extracts only the credential-free media suffix", () => {
    const url = new URL("http://provider.example:8080/live/demo-user/demo-pass/chunks/731_42.ts");
    expect(extractXtreamMediaPath(url, options.username, options.password)).toBe("chunks/731_42.ts");
  });

  it("preserves distinct relative segment paths", () => {
    const manifest = [
      "#EXTM3U",
      "#EXTINF:6,",
      "731_41.ts",
      "#EXTINF:6,",
      "731_42.ts",
    ].join("\n");

    const rewritten = rewriteHlsManifest(manifest, options);

    expect(rewritten).toContain(
      "/api/public/stream/live/731.ts?sourceExt=ts&upstreamPath=731_41.ts",
    );
    expect(rewritten).toContain(
      "/api/public/stream/live/731.ts?sourceExt=ts&upstreamPath=731_42.ts",
    );
    expect(rewritten.match(/upstreamPath=/g)).toHaveLength(2);
  });

  it("rewrites absolute Xtream segment URLs without exposing credentials", () => {
    const manifest = [
      "#EXTM3U",
      "#EXTINF:6,",
      "http://provider.example:8080/live/demo-user/demo-pass/731_43.ts",
    ].join("\n");

    const rewritten = rewriteHlsManifest(manifest, options);

    expect(rewritten).toContain("upstreamPath=731_43.ts");
    expect(rewritten).not.toContain("demo-user");
    expect(rewritten).not.toContain("demo-pass");
    expect(rewritten).not.toContain("provider.example");
  });

  it("rewrites key and init-segment URI attributes", () => {
    const manifest = [
      "#EXTM3U",
      '#EXT-X-KEY:METHOD=AES-128,URI="keys/731.key"',
      '#EXT-X-MAP:URI="init/731.mp4"',
    ].join("\n");

    const rewritten = rewriteHlsManifest(manifest, options);

    expect(rewritten).toContain("upstreamPath=keys%2F731.key");
    expect(rewritten).toContain("upstreamPath=init%2F731.mp4");
    expect(rewritten).not.toContain("demo-pass");
  });
});
