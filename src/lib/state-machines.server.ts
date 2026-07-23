/**
 * Explicit state machines for the billing domain. Import these instead of
 * hard-coding transition checks — they document every legal move and
 * refuse illegal ones with a clear error, so bugs surface at the write
 * site instead of leaving invalid rows in the DB.
 *
 * DB check-constraint note: `subscriptions.status` currently allows
 * ('trialing','active','past_due','canceled','paused'). We map the richer
 * lifecycle vocabulary (grace / suspended / cancelled / expired) onto
 * that set below so callers can think in domain terms.
 */

// -------- Subscription -----------------------------------------------------

export type SubscriptionLifecycleState =
  | "trial"
  | "active"
  | "past_due"
  | "grace"
  | "suspended"
  | "cancelled"
  | "expired";

export type SubscriptionDbState =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled";

export function toDbSubscriptionState(s: SubscriptionLifecycleState): SubscriptionDbState {
  switch (s) {
    case "trial": return "trialing";
    case "active": return "active";
    case "past_due":
    case "grace": return "past_due";
    case "suspended": return "paused";
    case "cancelled":
    case "expired": return "canceled";
  }
}

const SUB_TRANSITIONS: Record<SubscriptionLifecycleState, SubscriptionLifecycleState[]> = {
  trial:     ["active", "cancelled", "expired"],
  active:    ["past_due", "cancelled", "expired"],
  past_due:  ["active", "grace", "suspended", "cancelled"],
  grace:     ["active", "suspended", "cancelled", "expired"],
  suspended: ["active", "cancelled", "expired"],
  cancelled: [],
  expired:   ["active"], // reactivation
};

export function assertSubscriptionTransition(
  from: SubscriptionLifecycleState,
  to: SubscriptionLifecycleState,
): void {
  if (from === to) return;
  const allowed = SUB_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`illegal_subscription_transition:${from}->${to}`);
  }
}

// -------- Invoice ----------------------------------------------------------

export type InvoiceLifecycleState =
  | "draft"
  | "issued"
  | "sent"
  | "paid"
  | "partially_paid"
  | "overdue"
  | "cancelled"
  | "refunded";

const INV_TRANSITIONS: Record<InvoiceLifecycleState, InvoiceLifecycleState[]> = {
  draft:          ["issued", "cancelled"],
  issued:         ["sent", "paid", "partially_paid", "overdue", "cancelled"],
  sent:           ["paid", "partially_paid", "overdue", "cancelled"],
  partially_paid: ["paid", "overdue", "cancelled"],
  paid:           ["refunded"],
  overdue:        ["paid", "partially_paid", "cancelled"],
  cancelled:      [],
  refunded:       [],
};

export function assertInvoiceTransition(from: InvoiceLifecycleState, to: InvoiceLifecycleState): void {
  if (from === to) return;
  const allowed = INV_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) throw new Error(`illegal_invoice_transition:${from}->${to}`);
}

// -------- Payment ----------------------------------------------------------

export type PaymentLifecycleState =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"
  | "reversed";

const PAY_TRANSITIONS: Record<PaymentLifecycleState, PaymentLifecycleState[]> = {
  pending:    ["authorized", "captured", "failed"],
  authorized: ["captured", "failed", "reversed"],
  captured:   ["refunded", "reversed"],
  failed:     ["pending"], // retry cycle
  refunded:   [],
  reversed:   [],
};

export function assertPaymentTransition(from: PaymentLifecycleState, to: PaymentLifecycleState): void {
  if (from === to) return;
  const allowed = PAY_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) throw new Error(`illegal_payment_transition:${from}->${to}`);
}
