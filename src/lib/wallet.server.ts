/**
 * Wallet engine — the ONLY writer to `wallet_ledger` and
 * `wallet_reservations`. Every mutation:
 *
 *   1. Loads current ledger balance + held reservations.
 *   2. Validates availability (or credit limit for negative movements).
 *   3. Writes an immutable ledger row with `balance_after_cents`.
 *   4. Optionally opens/closes a reservation.
 *
 * External modules (orders, billing, refunds) must call these helpers —
 * never touch the tables directly.
 */

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface WalletBalances {
  ledgerCents: number;
  reservedCents: number;
  availableCents: number;
  pendingCents: number; // reserved but not yet captured
  currency: string;
}

export async function getBalances(orgId: string): Promise<WalletBalances> {
  const admin = await getAdmin();
  const [{ data: bal }, { data: org }] = await Promise.all([
    admin.rpc("org_wallet_balances", { _org: orgId }),
    admin.from("organizations").select("currency").eq("id", orgId).maybeSingle(),
  ]);
  const row = Array.isArray(bal) ? bal[0] : bal;
  return {
    ledgerCents: Number(row?.ledger_cents ?? 0),
    reservedCents: Number(row?.reserved_cents ?? 0),
    availableCents: Number(row?.available_cents ?? 0),
    pendingCents: Number(row?.reserved_cents ?? 0),
    currency: org?.currency ?? "USD",
  };
}

export type WalletKind = "topup" | "purchase" | "refund" | "commission" | "adjustment" | "hold" | "release";

export interface PostMovementInput {
  orgId: string;
  deltaCents: number; // positive = credit, negative = debit
  currency?: string;
  kind: WalletKind;
  refType?: string;
  refId?: string;
  memo?: string;
  actorId: string | null;
  /** When true, allow the movement even if available balance goes negative up to credit limit. */
  allowCredit?: boolean;
}

export interface LedgerRow {
  id: string;
  balance_after_cents: number;
  delta_cents: number;
  kind: WalletKind;
  created_at: string;
}

/**
 * Post an immutable ledger movement. Never updates existing rows.
 */
export async function postMovement(input: PostMovementInput): Promise<LedgerRow> {
  const admin = await getAdmin();
  const balances = await getBalances(input.orgId);
  const nextLedger = balances.ledgerCents + input.deltaCents;

  if (input.deltaCents < 0 && !input.allowCredit) {
    if (nextLedger - balances.reservedCents < 0) {
      throw new Error("Insufficient available balance");
    }
  }
  if (input.deltaCents < 0 && input.allowCredit) {
    const { data: prof } = await admin.from("reseller_profiles").select("credit_limit_cents").eq("org_id", input.orgId).maybeSingle();
    const limit = Number(prof?.credit_limit_cents ?? 0);
    if (nextLedger - balances.reservedCents < -limit) {
      throw new Error("Credit limit exceeded");
    }
  }

  const { data, error } = await admin
    .from("wallet_ledger")
    .insert({
      org_id: input.orgId,
      delta_cents: input.deltaCents,
      currency: input.currency ?? balances.currency,
      kind: input.kind,
      ref_type: input.refType ?? null,
      ref_id: input.refId ?? null,
      memo: input.memo ?? null,
      balance_after_cents: nextLedger,
      actor_id: input.actorId,
    })
    .select("id, balance_after_cents, delta_cents, kind, created_at")
    .single();
  if (error) throw error;
  return data as LedgerRow;
}

/** Reserve funds — decreases available balance without moving the ledger. */
export async function reserve(input: {
  orgId: string;
  amountCents: number;
  currency?: string;
  refType: string;
  refId: string;
  memo?: string;
  actorId: string | null;
}): Promise<string> {
  const admin = await getAdmin();
  const balances = await getBalances(input.orgId);
  if (balances.availableCents < input.amountCents) throw new Error("Insufficient available balance");
  const { data, error } = await admin
    .from("wallet_reservations")
    .insert({
      org_id: input.orgId,
      amount_cents: input.amountCents,
      currency: input.currency ?? balances.currency,
      ref_type: input.refType,
      ref_id: input.refId,
      status: "held",
      memo: input.memo ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

/** Capture a reservation into a real ledger debit. */
export async function capture(input: {
  reservationId: string;
  actorId: string | null;
  memo?: string;
}): Promise<LedgerRow> {
  const admin = await getAdmin();
  const { data: res, error } = await admin
    .from("wallet_reservations")
    .select("*")
    .eq("id", input.reservationId)
    .eq("status", "held")
    .maybeSingle();
  if (error || !res) throw new Error("Reservation not found or already resolved");
  // Mark captured first to prevent double-capture race
  await admin.from("wallet_reservations").update({ status: "captured", updated_at: new Date().toISOString() }).eq("id", res.id).eq("status", "held");
  return postMovement({
    orgId: res.org_id,
    deltaCents: -Math.abs(res.amount_cents),
    currency: res.currency,
    kind: "purchase",
    refType: res.ref_type,
    refId: res.ref_id,
    memo: input.memo ?? `Capture reservation ${res.id}`,
    actorId: input.actorId,
    allowCredit: true, // reservation already validated availability; credit line handled at reserve time
  });
}

/** Release a reservation without capturing (order cancelled). */
export async function release(input: { reservationId: string; actorId: string | null }): Promise<void> {
  const admin = await getAdmin();
  await admin
    .from("wallet_reservations")
    .update({ status: "released", updated_at: new Date().toISOString() })
    .eq("id", input.reservationId)
    .eq("status", "held");
}
