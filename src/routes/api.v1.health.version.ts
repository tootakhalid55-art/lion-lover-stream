import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, optionsResponse, API_VERSION } from "@/lib/api-response.server";
import { correlationFromRequest } from "@/lib/correlation.server";

async function handler({ request }: { request: Request }): Promise<Response> {
  const cid = correlationFromRequest(request);
  if (request.method === "OPTIONS") return optionsResponse(cid);
  return jsonResponse(
    {
      data: {
        name: "Nova TV Platform API",
        api_version: API_VERSION,
        commit: process.env.GIT_SHA || "unknown",
        build_time: process.env.BUILD_TIME || "unknown",
        runtime: "cloudflare-workers",
      },
    },
    { correlationId: cid },
  );
}

export const Route = createFileRoute("/api/v1/health/version")({
  server: { handlers: { GET: handler, OPTIONS: handler } },
});
