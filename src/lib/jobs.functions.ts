// Admin-facing job control server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listJobsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const [{ data: defs }, { data: runs }] = await Promise.all([
      context.supabase.from("job_definitions").select("*").order("code"),
      context.supabase
        .from("job_runs")
        .select("id, job_id, status, started_at, finished_at, duration_ms, error, triggered_by")
        .order("started_at", { ascending: false })
        .limit(200),
    ]);
    return { definitions: defs ?? [], runs: runs ?? [] };
  });

export const toggleJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ code: z.string(), enabled: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("job_definitions").update({ is_enabled: data.enabled }).eq("code", data.code);
    return { ok: true };
  });

export const runJobNowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ code: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { runJob } = await import("./jobs.server");
    // Register built-ins on demand so handlers are always bound in this runtime.
    await import("./jobs-registry.server");
    return runJob(data.code, `manual:${context.userId}`);
  });
