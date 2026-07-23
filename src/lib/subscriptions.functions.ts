// Client-callable server functions for the subscription engine.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      orgId: z.string().uuid(),
      planId: z.string().uuid(),
      quantity: z.number().int().positive().optional(),
      paymentMethodId: z.string().uuid().optional(),
      trialOverrideDays: z.number().int().min(0).max(365).optional(),
      collectionMethod: z.enum(["charge_automatically", "send_invoice"]).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { createSubscription } = await import("./subscriptions.server");
    return createSubscription({ ...data, actorId: context.userId });
  });

export const changePlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      subscriptionId: z.string().uuid(),
      newPlanId: z.string().uuid(),
      proration: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { changePlan } = await import("./subscriptions.server");
    return changePlan({ ...data, actorId: context.userId });
  });

export const cancelSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      subscriptionId: z.string().uuid(),
      atPeriodEnd: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { cancelSubscription } = await import("./subscriptions.server");
    await cancelSubscription({ ...data, actorId: context.userId });
    return { ok: true };
  });

export const listSubscriptionsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    const q = context.supabase
      .from("subscriptions")
      .select("id, org_id, plan_id, status, quantity, current_period_end, next_billing_at, dunning_stage")
      .order("created_at", { ascending: false })
      .limit(200);
    const { data, error } = await q;
    if (error) throw error;
    return { subscriptions: data ?? [], isAdmin: !!isAdmin };
  });
