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

export async function fetchXtreamMedia(
  input: string | URL,
  init: RequestInit,
  providerServerUrl: string,
  maxRedirects = 5,
): Promise<Response> {
  let target = new URL(input.toString());
  const visited = new Set<string>();

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const key = target.toString();
    if (visited.has(key)) throw new Error("Xtream media redirect loop");
    visited.add(key);

    const response = await fetch(target, {
      ...init,
      headers: headersForXtreamTarget(init.headers, target, providerServerUrl),
      redirect: "manual",
    });

    if (!REDIRECT_STATUSES.has(response.status)) return response;

    const location = response.headers.get("location");
    if (!location) return response;
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
