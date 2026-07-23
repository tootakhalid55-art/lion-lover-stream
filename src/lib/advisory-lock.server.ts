/**
 * Distributed locking via Postgres advisory locks. Ensures at most one
 * worker runs the guarded body for a given (scope, key) at a time —
 * critical for the recurring-billing loop, dunning walker, and webhook
 * drain when multiple workers execute the same cron tick.
 *
 * try_billing_lock uses pg_try_advisory_xact_lock, so the lock is
 * released automatically when the RPC transaction ends. That means:
 * every call is non-blocking; if another worker holds the lock we skip
 * this run entirely rather than serialising.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface LockResult<T> {
  acquired: boolean;
  result?: T;
  skippedReason?: string;
}

export async function withAdvisoryLock<T>(
  scope: string,
  key: string,
  fn: () => Promise<T>,
): Promise<LockResult<T>> {
  const { data, error } = await supabaseAdmin.rpc("try_billing_lock", { _scope: scope, _key: key });
  if (error) throw error;
  if (data !== true) return { acquired: false, skippedReason: "lock_held_by_other_worker" };
  try {
    const result = await fn();
    return { acquired: true, result };
  } finally {
    // pg_try_advisory_xact_lock releases at transaction end, which
    // happens as soon as the RPC returned above. Nothing to release here.
  }
}
