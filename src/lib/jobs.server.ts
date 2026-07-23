// Job runner registry. Handlers are registered by code and executed by
// scheduled pg_cron endpoints or the admin "Run Now" action. Every run
// is recorded in job_runs with duration/status/error and updates the
// definition's rolling stats.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { moveToDeadLetter } from "./outbox.server";

export interface JobContext {
  correlationId: string;
  runId: string;
  attempt: number;
  triggeredBy: string;
}

export type JobHandler = (ctx: JobContext) => Promise<Record<string, unknown> | void>;

const handlers = new Map<string, JobHandler>();

export function registerJob(code: string, handler: JobHandler): void {
  handlers.set(code, handler);
}

export function listRegisteredJobs(): string[] {
  return Array.from(handlers.keys());
}

export async function runJob(code: string, triggeredBy = "scheduler"): Promise<{
  runId: string;
  status: "success" | "failure";
  durationMs: number;
  error?: string;
}> {
  const { data: def, error: defErr } = await supabaseAdmin
    .from("job_definitions")
    .select("id, code, max_retries, is_enabled")
    .eq("code", code)
    .maybeSingle();
  if (defErr) throw defErr;
  if (!def) throw new Error(`Job not registered: ${code}`);
  if (!def.is_enabled) throw new Error(`Job disabled: ${code}`);

  const handler = handlers.get(code);
  if (!handler) throw new Error(`No handler bound for job: ${code}`);

  const correlationId = crypto.randomUUID();
  const startedAt = Date.now();
  const { data: run, error: runErr } = await supabaseAdmin
    .from("job_runs")
    .insert({ job_id: def.id, status: "running", triggered_by: triggeredBy, correlation_id: correlationId })
    .select("id")
    .single();
  if (runErr) throw runErr;

  try {
    const output = (await handler({ correlationId, runId: run.id, attempt: 1, triggeredBy })) ?? {};
    const durationMs = Date.now() - startedAt;
    await supabaseAdmin
      .from("job_runs")
      .update({ status: "success", finished_at: new Date().toISOString(), duration_ms: durationMs, output })
      .eq("id", run.id);
    await supabaseAdmin
      .from("job_definitions")
      .update({
        last_run_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        avg_runtime_ms: durationMs,
      })
      .eq("id", def.id);
    return { runId: run.id, status: "success", durationMs };
  } catch (e) {
    const err = e as Error;
    const durationMs = Date.now() - startedAt;
    await supabaseAdmin
      .from("job_runs")
      .update({
        status: "failure",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        error: err.message,
      })
      .eq("id", run.id);
    await supabaseAdmin
      .from("job_definitions")
      .update({ last_run_at: new Date().toISOString(), last_failure_at: new Date().toISOString() })
      .eq("id", def.id);
    await moveToDeadLetter({
      source: `job:${code}`,
      sourceId: run.id,
      eventType: "job.failure",
      payload: { code, triggeredBy },
      error: err.message,
      attempts: 1,
      correlationId,
    });
    return { runId: run.id, status: "failure", durationMs, error: err.message };
  }
}
