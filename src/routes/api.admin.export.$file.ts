/**
 * Authenticated CSV/XLSX export endpoint.
 * URL: /api/admin/export/:dataset.:format?token=<bearer>
 *
 * Uses a query token because <a download> can't set an Authorization header.
 * The token is the Supabase access_token attached the same way as server fns.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { collect, toCsv, toXlsx, contentType, type Dataset, type Format } from "@/lib/export.server";
import { capabilitiesFor, type AppRole } from "@/lib/auth-utils";

const VALID: Record<Dataset, true> = { users: true, packages: true, licenses: true, devices: true, sessions: true, security: true, audit: true };

export const Route = createFileRoute("/api/admin/export/$file")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const [name, ext] = params.file.split(".");
        const dataset = name as Dataset;
        const format = ext as Format;
        if (!VALID[dataset]) return new Response("Bad dataset", { status: 400 });
        if (format !== "csv" && format !== "xlsx") return new Response("Bad format", { status: 400 });

        const url = new URL(request.url);
        const token = url.searchParams.get("token") || (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supaUrl = process.env.SUPABASE_URL!;
        const cli = createClient(supaUrl, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              h.set("Authorization", `Bearer ${token}`);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data: userData, error: userErr } = await cli.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
        const { data: roles } = await cli.from("user_roles").select("role").eq("user_id", userData.user.id);
        const caps = capabilitiesFor(((roles ?? []) as any[]).map((r) => r.role as AppRole));
        if (!caps.canExport) return new Response("Forbidden", { status: 403 });

        const { headers, rows } = await collect(dataset);
        const body = format === "csv" ? toCsv(headers, rows) : toXlsx(headers, rows, dataset);
        return new Response(body, {
          status: 200,
          headers: {
            "content-type": contentType(format),
            "content-disposition": `attachment; filename="nova-${dataset}-${new Date().toISOString().slice(0, 10)}.${format}"`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
