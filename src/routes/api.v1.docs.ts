import { createFileRoute } from "@tanstack/react-router";

const HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Nova TV API — Swagger UI</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>body{margin:0;background:#0b0b0f}</style>
</head>
<body>
  <div id="swagger"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/api/v1/openapi',
      dom_id: '#swagger',
      deepLinking: true,
      persistAuthorization: true,
    });
  </script>
</body>
</html>`;

export const Route = createFileRoute("/api/v1/docs")({
  server: {
    handlers: {
      GET: async () =>
        new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8" } }),
    },
  },
});
