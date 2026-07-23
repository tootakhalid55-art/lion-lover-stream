import { createFileRoute } from "@tanstack/react-router";
import { makeV1Handler } from "@/lib/api-v1-handler.server";
import { WEBHOOK_EVENTS } from "@/lib/webhooks.server";

function randToken(len: number): string {
  const alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < len; i++) s += alpha[bytes[i] % alpha.length];
  return s;
}

const handler = makeV1Handler(
  {
    GET: {
      scopes: ["webhooks:read"],
      fn: async ({ ctx }) => {
        const { data, error } = await ctx.admin
          .from("webhook_endpoints")
          .select("id, url, description, events, active, created_at, updated_at")
          .eq("org_id", ctx.orgId)
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        return { data: data ?? [] };
      },
    },
    POST: {
      scopes: ["webhooks:manage"],
      fn: async ({ ctx, body }) => {
        if (!body || typeof body !== "object") throw new Error("Invalid body");
        try {
          const u = new URL(String(body.url));
          if (!/^https?:$/.test(u.protocol)) throw new Error();
        } catch {
          throw new Error("Invalid URL");
        }
        const events = Array.isArray(body.events)
          ? (body.events as string[]).filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e))
          : [];
        if (events.length === 0) throw new Error("At least one valid event required");
        const secret = randToken(48);
        const { data, error } = await ctx.admin
          .from("webhook_endpoints")
          .insert({
            org_id: ctx.orgId,
            url: body.url,
            description: body.description ?? null,
            events,
            secret,
            active: true,
          })
          .select("id, url, events, active, created_at")
          .single();
        if (error || !data) throw new Error(error?.message || "Create failed");
        return { data: { ...data, secret }, status: 201 };
      },
    },
  },
  "/api/v1/webhooks/endpoints",
);

export const Route = createFileRoute("/api/v1/webhooks/endpoints")({
  server: { handlers: { GET: handler, POST: handler, OPTIONS: handler } },
});
