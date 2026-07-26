import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchXtreamMedia,
  headersForXtreamTarget,
  isIpHostname,
  safeDirectSourceUrl,
} from "../xtream-media.server";

describe("Xtream media redirects", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recognizes IPv4 and IPv6 redirect hosts", () => {
    expect(isIpHostname("104.21.46.229")).toBe(true);
    expect(isIpHostname("2606:4700:3030::6815:2ee5")).toBe(true);
    expect(isIpHostname("provider.example")).toBe(false);
  });

  it("accepts public HTTP direct sources and rejects local targets", () => {
    expect(safeDirectSourceUrl("https://media.example/video/1.mp4")).toBe(
      "https://media.example/video/1.mp4",
    );
    expect(safeDirectSourceUrl("http://127.0.0.1/video.mp4")).toBeNull();
    expect(safeDirectSourceUrl("http://192.168.1.10/video.mp4")).toBeNull();
    expect(safeDirectSourceUrl("javascript:alert(1)")).toBeNull();
  });

  it("retains the provider Host header for an IP redirect", () => {
    const headers = headersForXtreamTarget(
      { range: "bytes=0-1023" },
      new URL("http://104.21.46.229:8080/movie/u/p/1.mp4"),
      "http://provider.example:8080",
    );

    expect(headers.get("host")).toBe("provider.example");
    expect(headers.get("range")).toBe("bytes=0-1023");
  });

  it("follows an Xtream IP redirect manually with the provider Host header", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "http://104.21.46.229:8080/movie/u/p/1.mp4" },
        }),
      )
      .mockResolvedValueOnce(new Response("video", { status: 206 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchXtreamMedia(
      "http://provider.example:8080/movie/u/p/1.mp4",
      { method: "GET", headers: { range: "bytes=0-1023" } },
      "http://provider.example:8080",
    );

    expect(response.status).toBe(206);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe("manual");
    const redirectedHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(redirectedHeaders.get("host")).toBe("provider.example");
  });
});
