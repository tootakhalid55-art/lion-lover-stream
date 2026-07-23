// Bind default handlers for the seeded job codes.
import { registerJob } from "./jobs.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { expireIfBeyondGrace } from "./subscriptions.server";
import { runRenewal } from "./subscription-workflow.server";
import { runDunningTick } from "./dunning-engine.server";

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
    let renewed = 0, failed = 0, skipped = 0;
    for (const s of data ?? []) {
      const r = await runRenewal({ subscriptionId: s.id });
      if (r.status === "renewed") renewed++;
      else if (r.status === "payment_failed") failed++;
      else skipped++;
    }
    return { renewed, failed, skipped, scanned: data?.length ?? 0 };
  });

  registerJob("billing.expire_subscriptions", async () => {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .in("status", ["past_due", "paused"])
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

  registerJob("billing.dunning_run", async () => runDunningTick(100));

  registerJob("billing.generate_invoices", async () => ({ skipped: true, note: "issued inline by renewal workflow" }));
  registerJob("billing.collect_payments", async () => ({ skipped: true, note: "collected inline by renewal workflow" }));
  registerJob("webhooks.retry", async () => ({ skipped: true, note: "wired in 7C" }));
  registerJob("outbox.dispatch", async () => ({ skipped: true, note: "wired in 7C" }));
  registerJob("usage.aggregate", async () => ({ skipped: true, note: "wired in 7C" }));
  registerJob("billing.overdue_detection", async () => ({ skipped: true, note: "wired in 7C" }));
  registerJob("notifications.dispatch", async () => ({ skipped: true, note: "wired in 7C" }));
}

