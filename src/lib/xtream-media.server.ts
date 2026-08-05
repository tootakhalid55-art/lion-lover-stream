const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export function isIpHostname(hostname: string): boolean {
  const value = hostname.replace(/^\[|\]$/g, "");
  if (value.includes(":")) return /^[0-9a-f:]+$/i.test(value);

  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
  );
}

export function safeDirectSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".local")) return null;
    if (/^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname)) return null;
    const private172 = hostname.match(/^172\.(\d{1,3})\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return null;
    if (hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd")) return null;

    return url.toString();
  } catch {
    return null;
  }
}

export function headersForXtreamTarget(
  headers: HeadersInit | undefined,
  target: URL,
  providerServerUrl: string,
): Headers {
  const next = new Headers(headers);
  if (isIpHostname(target.hostname)) {
    // Some Xtream panels redirect media URLs to a Cloudflare edge IP.
    // Cloudflare rejects a request whose Host header is that IP with error
    // 1003, so retain the configured provider hostname while connecting to
    // the redirected address.
    next.set("host", new URL(providerServerUrl).hostname);
  } else {
    next.delete("host");
  }
  return next;
}

function responseWithRedirectTrace(response: Response, target: URL, redirectCount: number): Response {
  const headers = new Headers(response.headers);
  headers.set("x-xtream-final-host-type", isIpHostname(target.hostname) ? "ip" : "domain");
  headers.set("x-xtream-redirect-count", String(redirectCount));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function fetchXtreamMedia(
  input: string | URL,
  init: RequestInit,
  providerServerUrl: string,
  maxRedirects = 5,
  routing: { viaCountry?: string | null } = {},
): Promise<Response> {
  let target = new URL(input.toString());
  const visited = new Set<string>();

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const key = target.toString();
    if (visited.has(key)) throw new Error("Xtream media redirect loop");
    visited.add(key);

    const headers = headersForXtreamTarget(init.headers, target, providerServerUrl);
    const forwardHost = headers.get("host") ?? undefined;

    // Geo-unblock: route the upstream hop through an exit node when one is
    // configured. Falls back to a direct fetch automatically.
    let response: Response;
    try {
      const { routedFetch } = await import("./vpn.server");
      const routed = await routedFetch(
        target,
        { ...init, headers, redirect: "manual" },
        { ...(forwardHost ? { forwardHost } : {}), viaCountry: routing.viaCountry ?? null },
      );
      response = routed.response;
    } catch {
      response = await fetch(target, { ...init, headers, redirect: "manual" });
    }


    if (response.status === 403 && isIpHostname(target.hostname)) {
      const errorText = await response.clone().text().catch(() => "");
      if (/\berror\s+code:\s*1003\b/i.test(errorText)) {
        const provider = new URL(providerServerUrl);
        const rewritten = new URL(target);
        rewritten.hostname = provider.hostname;
        if (!visited.has(rewritten.toString())) {
          await response.body?.cancel().catch(() => undefined);
          target = rewritten;
          continue;
        }
      }
    }

    if (!REDIRECT_STATUSES.has(response.status)) {
      return responseWithRedirectTrace(response, target, redirectCount);
    }

    const location = response.headers.get("location");
    if (!location) return responseWithRedirectTrace(response, target, redirectCount);
    if (redirectCount === maxRedirects) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error("Xtream media exceeded redirect limit");
    }

    const nextTarget = new URL(location, target);
    await response.body?.cancel().catch(() => undefined);
    target = nextTarget;
  }

  throw new Error("Xtream media redirect failed");
}
