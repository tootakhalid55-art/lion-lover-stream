function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function errorStack(error: unknown): string {
  return error instanceof Error && error.stack ? error.stack : "";
}

export function renderErrorPage(error?: unknown, requestUrl = "unknown"): string {
  const message = escapeHtml(error ? errorMessage(error) : "Unknown server runtime exception");
  const stack = escapeHtml(errorStack(error));
  const url = escapeHtml(requestUrl);
  return `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8" />
    <title>Runtime exception</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #0b0b0f; color: #fee2e2; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 56rem; margin: 4rem auto; width: 100%; padding: 1.5rem; border: 1px solid rgba(248,113,113,.35); border-radius: 1rem; background: rgba(127,29,29,.22); }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #fecaca; margin: 0 0 1rem; }
      dl { display: grid; gap: .5rem; margin: 1rem 0; color: #fecaca; }
      dt { font-weight: 700; color: #fff; }
      dd { margin: 0; word-break: break-word; }
      pre { max-height: 24rem; overflow: auto; white-space: pre-wrap; background: rgba(0,0,0,.45); border-radius: .75rem; padding: 1rem; color: #fff; font-size: 12px; }
      .actions { display: flex; gap: 0.5rem; justify-content: flex-start; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #fecaca; color: #450a0a; }
      .secondary { background: transparent; color: #fee2e2; border-color: rgba(254,202,202,.3); }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Runtime exception</h1>
      <p>${message}</p>
      <dl>
        <div><dt>Request URL</dt><dd>${url}</dd></div>
      </dl>
      ${stack ? `<pre>${stack}</pre>` : ""}
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
