const RECOVERABLE_LOAD_ERROR =
  /FORCE_RELOAD|postMessage\(\{\s*type:\s*["']FORCE_RELOAD["']|Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError|Unable to preload CSS/i;

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isRecoverableClientLoadError(error: unknown): boolean {
  return RECOVERABLE_LOAD_ERROR.test(errorText(error));
}

export function requestClientReload(error: unknown, scope = "global"): boolean {
  if (typeof window === "undefined" || !isRecoverableClientLoadError(error)) return false;

  const key = `__liontv_recoverable_reload_at:${scope}`;
  const last = Number(window.sessionStorage.getItem(key) ?? 0);
  if (Date.now() - last < 30_000) return false;

  window.sessionStorage.setItem(key, String(Date.now()));
  window.parent?.postMessage?.({ type: "FORCE_RELOAD" }, "*");
  window.setTimeout(() => window.location.reload(), 80);
  return true;
}