// Transactional outbox helper. All domain events for external delivery
// (webhooks, notifications, revenue posting) should be recorded here in the
// same transaction as the state change, then drained by a background job.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface OutboxEnqueue {
  aggregateType: string;
  aggregateId?: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  delayMs?: number;
}

export async function enqueueOutbox(evt: OutboxEnqueue): Promise<string> {
  const nextAt = new Date(Date.now() + (evt.delayMs ?? 0)).toISOString();
  const { data, error } = await supabaseAdmin
    .from("outbox_events")
    .insert({
      aggregate_type: evt.aggregateType,
      aggregate_id: evt.aggregateId ?? null,
      event_type: evt.eventType,
      payload: evt.payload,
      correlation_id: evt.correlationId ?? null,
      next_attempt_at: nextAt,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function moveToDeadLetter(opts: {
  source: string;
  sourceId?: string | null;
  eventType?: string | null;
  payload: Record<string, unknown>;
  error: string;
  attempts: number;
  correlationId?: string | null;
}): Promise<void> {
  await supabaseAdmin.from("dead_letter_queue").insert({
    source: opts.source,
    source_id: opts.sourceId ?? null,
    event_type: opts.eventType ?? null,
    payload: opts.payload,
    error: opts.error,
    attempts: opts.attempts,
    correlation_id: opts.correlationId ?? null,
  });
}

/** Exponential backoff with jitter, capped. */
export function nextBackoffMs(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 60 * 60 * 1000); // cap 1h
  const jitter = Math.floor(Math.random() * 1000);
  return base + jitter;
}
