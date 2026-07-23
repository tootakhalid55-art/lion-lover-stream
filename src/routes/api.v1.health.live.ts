import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, optionsResponse } from "@/lib/api-response.server";
import { correlationFromRequest } from "@/lib/correlation.server";

async function handler({ request }: { request: Request }): Promise<Response> {
  const cid = correlationFromRequest(request);
  if (request.method === "OPTIONS") return optionsResponse(cid);
  return jsonResponse({ data: { status: "ok", ts: new Date().toISOString() } }, { correlationId: cid });
}

export const Route = createFileRoute("/api/v1/health/live")({
  server: { handlers: { GET: handler, OPTIONS: handler } },
});
