// Bind default handlers for the seeded job codes. Individual handlers are
// intentionally lightweight in this sub-step — they'll be fleshed out in
// Step 7B (recurring billing, dunning walk, webhook drain) and 7C
// (notification dispatch, reconciliation import).
import { registerJob } from "./jobs.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { expireIfBeyondGrace, renewSubscription } from "./subscriptions.server";

let bound = false;
if (!bound) {
  bound = true;

  registerJob("billing.renew_subscriptions", async () => {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("id, org_id")
      .in("status", ["active", "trialing"])
      .lte("next_billing_at", new Date().toISOString())
      .limit(100);
    let renewed = 0;
    for (const s of data ?? []) {
      try { await renewSubscription(s.id); renewed++; } catch (e) { /* logged via outbox */ }
    }
    return { renewed, scanned: data?.length ?? 0 };
  });

  registerJob("billing.expire_subscriptions", async () => {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .in("status", ["past_due", "grace"])
      .lte("grace_period_ends_at", new Date().toISOString())
      .limit(200);
    for (const s of data ?? []) await expireIfBeyondGrace(s.id);
    return { expired: data?.length ?? 0 };
  });

  registerJob("licensing.expire_licenses", async () => {
    const { data, error } = await supabaseAdmin
      .from("licenses")
      .update({ status: "expired" })
      .lte("expires_at", new Date().toISOString())
      .eq("status", "active")
      .select("id");
    if (error) throw error;
    return { expired: data?.length ?? 0 };
  });

  registerJob("billing.generate_invoices", async () => ({ skipped: true, note: "wired in 7B" }));
  registerJob("billing.collect_payments", async () => ({ skipped: true, note: "wired in 7B" }));
  registerJob("billing.dunning_run", async () => ({ skipped: true, note: "wired in 7B" }));
  registerJob("webhooks.retry", async () => ({ skipped: true, note: "wired in 7B" }));
  registerJob("outbox.dispatch", async () => ({ skipped: true, note: "wired in 7B" }));
  registerJob("usage.aggregate", async () => ({ skipped: true, note: "wired in 7C" }));
  registerJob("billing.overdue_detection", async () => ({ skipped: true, note: "wired in 7B" }));
  registerJob("notifications.dispatch", async () => ({ skipped: true, note: "wired in 7C" }));
}
