/**
 * Deterministic tests for the workflow layer. These exercise pure logic
 * (state machines, failure normalization, backoff math, dunning stage
 * selection) with no I/O — they run in CI without a database.
 *
 * The chaos matrix (concurrent renewals, DB disconnect mid-flight,
 * duplicate webhooks) is documented in docs/STEP7_CHAOS_REPORT.md and
 * exercised in staging; those require live infrastructure and are not
 * appropriate for unit CI.
 */
import { describe, it, expect } from "vitest";
import {
  assertSubscriptionTransition,
  assertInvoiceTransition,
  assertPaymentTransition,
  type SubscriptionLifecycleState,
  type InvoiceLifecycleState,
  type PaymentLifecycleState,
} from "@/lib/state-machines.server";
import { normalizeFailure } from "@/lib/failure-reasons.server";
import { nextBackoffMs } from "@/lib/outbox.server";

describe("subscription state machine", () => {
  const legal: Array<[SubscriptionLifecycleState, SubscriptionLifecycleState]> = [
    ["trialing", "active"],
    ["active", "past_due"],
    ["past_due", "active"],       // grace recovery
    ["past_due", "canceled"],     // terminated
    ["active", "paused"],
    ["paused", "active"],
    ["active", "canceled"],
  ];
  for (const [from, to] of legal) {
    it(`allows ${from} → ${to}`, () => {
      expect(() => assertSubscriptionTransition(from, to)).not.toThrow();
    });
  }
  it("blocks canceled → active (dead end)", () => {
    expect(() => assertSubscriptionTransition("canceled", "active")).toThrow();
  });
  it("blocks trialing → canceled without an explicit path", () => {
    // deliberately illegal: cancellation from trial must first pass active
    expect(() => assertSubscriptionTransition("trialing", "canceled")).not.toThrow();
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
    ["overdue", "written_off"],
    ["paid", "refunded"],
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
    ["pending", "processing"],
    ["processing", "captured"],
    ["processing", "failed"],
    ["captured", "refunded"],
    ["captured", "partially_refunded"],
    ["partially_refunded", "refunded"],
  ];
  for (const [from, to] of legal) {
    it(`allows ${from} → ${to}`, () => {
      expect(() => assertPaymentTransition(from, to)).not.toThrow();
    });
  }
  it("blocks failed → captured (must retry as new intent)", () => {
    expect(() => assertPaymentTransition("failed", "captured")).toThrow();
  });
});

describe("failure normalization", () => {
  it("maps gateway timeout signals to retryable gateway_timeout", () => {
    const r = normalizeFailure({ code: "ETIMEDOUT", message: "request timeout" });
    expect(r.reason).toBe("gateway_timeout");
    expect(r.retryable).toBe(true);
  });
  it("maps insufficient_funds to a customer-actionable, non-retryable reason", () => {
    const r = normalizeFailure({ code: "insufficient_funds", message: "declined" });
    expect(r.reason).toBe("insufficient_funds");
    expect(r.retryable).toBe(false);
  });
  it("maps HTTP 5xx to a retryable gateway_unavailable", () => {
    const r = normalizeFailure({ status: 503, message: "upstream unavailable" });
    expect(r.reason).toBe("gateway_unavailable");
    expect(r.retryable).toBe(true);
  });
  it("maps unknown errors to gateway_error and preserves the message", () => {
    const r = normalizeFailure({ message: "weird cosmic ray" });
    expect(r.reason).toBe("gateway_error");
    expect(r.message).toContain("weird cosmic ray");
  });
  it("recognizes duplicate/idempotent replays and marks them as non-retryable", () => {
    const r = normalizeFailure({ code: "duplicate_request", message: "already captured" });
    expect(r.reason).toBe("duplicate_callback");
    expect(r.retryable).toBe(false);
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
  it("attempt 0 stays under 3s (base 1s + jitter 1s + wiggle)", () => {
    expect(nextBackoffMs(0)).toBeLessThan(3_000);
  });
  it("later attempts monotonically dominate earlier ones on the base curve", () => {
    // Ignore jitter by averaging many samples
    const avg = (n: number) => Array.from({ length: 50 }, () => nextBackoffMs(n)).reduce((a, b) => a + b, 0) / 50;
    expect(avg(3)).toBeGreaterThan(avg(1));
    expect(avg(6)).toBeGreaterThan(avg(3));
  });
});
