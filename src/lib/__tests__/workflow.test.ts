/**
 * Deterministic tests for the workflow layer. Pure logic only — no I/O.
 * Live chaos scenarios (concurrent renewals, DB disconnect, replayed
 * webhooks) are exercised in staging per docs/STEP7_CHAOS_REPORT.md.
 */
import { describe, it, expect } from "vitest";
import {
  assertSubscriptionTransition,
  assertInvoiceTransition,
  assertPaymentTransition,
  toDbSubscriptionState,
  type SubscriptionLifecycleState,
  type InvoiceLifecycleState,
  type PaymentLifecycleState,
} from "@/lib/state-machines.server";
import { normalizeFailure } from "@/lib/failure-reasons.server";
import { nextBackoffMs } from "@/lib/outbox.server";

describe("subscription state machine", () => {
  const legal: Array<[SubscriptionLifecycleState, SubscriptionLifecycleState]> = [
    ["trial", "active"],
    ["active", "past_due"],
    ["past_due", "grace"],
    ["grace", "active"],
    ["past_due", "suspended"],
    ["suspended", "active"],
    ["active", "cancelled"],
    ["expired", "active"],
  ];
  for (const [from, to] of legal) {
    it(`allows ${from} → ${to}`, () => {
      expect(() => assertSubscriptionTransition(from, to)).not.toThrow();
    });
  }
  it("blocks cancelled → active (dead end)", () => {
    expect(() => assertSubscriptionTransition("cancelled", "active")).toThrow();
  });
  it("collapses rich lifecycle states onto the DB check-constraint vocabulary", () => {
    expect(toDbSubscriptionState("grace")).toBe("past_due");
    expect(toDbSubscriptionState("suspended")).toBe("paused");
    expect(toDbSubscriptionState("expired")).toBe("canceled");
    expect(toDbSubscriptionState("cancelled")).toBe("canceled");
  });
});

describe("invoice state machine", () => {
  const legal: Array<[InvoiceLifecycleState, InvoiceLifecycleState]> = [
    ["draft", "issued"],
    ["issued", "sent"],
    ["sent", "partially_paid"],
    ["partially_paid", "paid"],
    ["sent", "paid"],
    ["sent", "overdue"],
    ["overdue", "paid"],
    ["paid", "refunded"],
    ["draft", "cancelled"],
  ];
  for (const [from, to] of legal) {
    it(`allows ${from} → ${to}`, () => {
      expect(() => assertInvoiceTransition(from, to)).not.toThrow();
    });
  }
  it("blocks refunded → paid", () => {
    expect(() => assertInvoiceTransition("refunded", "paid")).toThrow();
  });
});

describe("payment state machine", () => {
  const legal: Array<[PaymentLifecycleState, PaymentLifecycleState]> = [
    ["pending", "authorized"],
    ["authorized", "captured"],
    ["pending", "captured"],
    ["captured", "refunded"],
    ["captured", "reversed"],
    ["failed", "pending"],
  ];
  for (const [from, to] of legal) {
    it(`allows ${from} → ${to}`, () => {
      expect(() => assertPaymentTransition(from, to)).not.toThrow();
    });
  }
  it("blocks refunded → captured (must retry as new intent)", () => {
    expect(() => assertPaymentTransition("refunded", "captured")).toThrow();
  });
  it("blocks failed → captured (must go pending first)", () => {
    expect(() => assertPaymentTransition("failed", "captured")).toThrow();
  });
});

describe("failure normalization", () => {
  it("maps ETIMEDOUT to retryable gateway_timeout", () => {
    const r = normalizeFailure({ code: "ETIMEDOUT", message: "request timeout" });
    expect(r.reason).toBe("gateway_timeout");
    expect(r.retryable).toBe(true);
  });
  it("maps insufficient_funds to a retry-after-dunning reason", () => {
    const r = normalizeFailure({ code: "insufficient_funds", message: "declined" });
    expect(r.reason).toBe("insufficient_funds");
    expect(r.permanent).toBe(false);
  });
  it("maps HTTP 5xx to retryable gateway_unavailable", () => {
    const r = normalizeFailure({ status: 503, message: "upstream unavailable" });
    expect(r.reason).toBe("gateway_unavailable");
    expect(r.retryable).toBe(true);
  });
  it("maps card_expired as permanent, non-retryable", () => {
    const r = normalizeFailure({ code: "card_expired", message: "expired" });
    expect(r.reason).toBe("card_expired");
    expect(r.retryable).toBe(false);
    expect(r.permanent).toBe(true);
  });
  it("recognizes duplicate/idempotent replays", () => {
    const r = normalizeFailure({ code: "duplicate", message: "already captured" });
    expect(r.reason).toBe("duplicate_callback");
    expect(r.retryable).toBe(false);
  });
  it("recognizes HTTP 409 as duplicate_callback", () => {
    const r = normalizeFailure({ status: 409 });
    expect(r.reason).toBe("duplicate_callback");
  });
  it("falls back to unknown and preserves the message", () => {
    const r = normalizeFailure({ message: "weird cosmic ray" });
    expect(r.reason).toBe("unknown");
    expect(r.message).toContain("weird cosmic ray");
  });
});

describe("retry backoff", () => {
  it("grows exponentially with jitter and caps at 1h", () => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const b = nextBackoffMs(attempt);
      expect(b).toBeGreaterThan(0);
      expect(b).toBeLessThanOrEqual(3_600_000 + 1_000);
    }
  });
  it("attempt 0 stays under 3s (base 1s + jitter <1s)", () => {
    expect(nextBackoffMs(0)).toBeLessThan(3_000);
  });
  it("later attempts monotonically dominate earlier ones on average", () => {
    const avg = (n: number) => Array.from({ length: 50 }, () => nextBackoffMs(n)).reduce((a, b) => a + b, 0) / 50;
    expect(avg(3)).toBeGreaterThan(avg(1));
    expect(avg(6)).toBeGreaterThan(avg(3));
  });
});
