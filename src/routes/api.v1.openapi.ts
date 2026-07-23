import { createFileRoute } from "@tanstack/react-router";
import { buildOpenApiDoc } from "@/lib/openapi.server";

export const Route = createFileRoute("/api/v1/openapi")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const doc = buildOpenApiDoc(`${url.protocol}//${url.host}`);
        return new Response(JSON.stringify(doc), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "access-control-allow-origin": "*",
          },
        });
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,OPTIONS" },
        }),
    },
  },
});
