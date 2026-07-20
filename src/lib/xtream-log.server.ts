/**
 * Audit logger for upstream Xtream calls.
 * Records failures + slow calls WITHOUT logging credentials, tokens, or
 * request bodies. Kept in a ring buffer per Worker instance.
 */

export interface AuditEntry {
  ts: number;
  action: string;
  ok: boolean;
  status?: number;
  durationMs: number;
  error?: string;
  attempt?: number;
}

const BUFFER_SIZE = 200;
const buffer: AuditEntry[] = [];

export function record(entry: AuditEntry) {
  buffer.push(entry);
  if (buffer.length > BUFFER_SIZE) buffer.splice(0, buffer.length - BUFFER_SIZE);
  // Mirror failures + slow calls to console (no sensitive fields).
  if (!entry.ok) {
    console.warn(
      `[xtream] ${entry.action} FAIL status=${entry.status ?? "-"} attempt=${entry.attempt ?? 1} dur=${entry.durationMs}ms err=${entry.error ?? ""}`,
    );
  } else if (entry.durationMs > 5000) {
    console.warn(`[xtream] ${entry.action} SLOW dur=${entry.durationMs}ms`);
  }
}

export function recent(limit = 50): AuditEntry[] {
  return buffer.slice(-limit).reverse();
}

/** Strip credentials from a URL before logging. */
export function safeUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has("password")) u.searchParams.set("password", "***");
    if (u.searchParams.has("username")) u.searchParams.set("username", "***");
    // Strip embedded creds from path: /live/USER/PASS/ID.ext
    u.pathname = u.pathname.replace(
      /^\/(live|movie|series)\/[^/]+\/[^/]+\//,
      "/$1/***/***/",
    );
    return `${u.origin}${u.pathname}${u.search}`;
  } catch {
    return "invalid-url";
  }
}
