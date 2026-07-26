export interface HlsProxyRewriteOptions {
  kind: "movie" | "series" | "live";
  streamId: string;
  sourceExt: string;
  manifestUrl: string;
  username: string;
  password: string;
}

function decodePathPart(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded || decoded === "." || decoded === ".." || /[\/\\\0-\x1f]/.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function extractXtreamMediaPath(
  mediaUrl: URL,
  username: string,
  password: string,
): string | null {
  const parts = mediaUrl.pathname.split("/").filter(Boolean).map(decodePathPart);
  const credentialIndex = parts.findIndex(
    (part, index) => part === username && parts[index + 1] === password,
  );
  if (credentialIndex < 0) return null;

  const suffix = parts.slice(credentialIndex + 2);
  if (!suffix.length || suffix.some((part) => part === null)) return null;
  return (suffix as string[]).join("/");
}

function extensionForPath(path: string): string {
  const file = path.split("/").pop() || "";
  return file.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase() || "bin";
}

function fallbackProxyUrl(options: HlsProxyRewriteOptions): string {
  const query = new URLSearchParams({ sourceExt: options.sourceExt });
  return `/api/public/stream/${options.kind}/${encodeURIComponent(options.streamId)}.ts?${query}`;
}

function rewriteUri(rawUri: string, options: HlsProxyRewriteOptions): string {
  try {
    const resolved = new URL(rawUri, options.manifestUrl);
    const upstreamPath = extractXtreamMediaPath(resolved, options.username, options.password);
    if (!upstreamPath) return fallbackProxyUrl(options);

    const query = new URLSearchParams({
      sourceExt: options.sourceExt,
      upstreamPath,
    });
    return `/api/public/stream/${options.kind}/${encodeURIComponent(options.streamId)}.${extensionForPath(upstreamPath)}?${query}`;
  } catch {
    return fallbackProxyUrl(options);
  }
}

export function rewriteHlsManifest(text: string, options: HlsProxyRewriteOptions): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI=(["'])(.*?)\1/gi, (_match, quote: string, uri: string) => {
          return `URI=${quote}${rewriteUri(uri, options)}${quote}`;
        });
      }
      return rewriteUri(trimmed, options);
    })
    .join("\n");
}
