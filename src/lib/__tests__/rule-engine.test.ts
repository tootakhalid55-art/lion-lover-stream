import { describe, expect, it } from "vitest";
import { PRICING_PRIORITY, runRules, type Rule } from "@/lib/rule-engine.server";

interface Facts { qty: number; org: string | null; country: string | null }

describe("rule-engine", () => {
  it("evaluates rules in priority order and records a trace", () => {
    const rules: Rule<Facts>[] = [
      {
        name: "default", domain: "pricing", priority: PRICING_PRIORITY.default,
        evaluate: () => ({ effect: { kind: "set", value: 1000 }, reason: "default" }),
      },
      {
        name: "region-eg", domain: "pricing", priority: PRICING_PRIORITY.regional,
        evaluate: (f) => f.country === "EG" ? ({ effect: { kind: "set", value: 800 }, reason: "EG region" }) : null,
      },
      {
        name: "coupon-20", domain: "coupon", priority: 200,
        evaluate: () => ({ effect: { kind: "multiply", value: 0.8 }, reason: "20% coupon" }),
      },
    ];
    const r = runRules(rules, { qty: 1, org: null, country: "EG" }, { initial: 0, currency: "USD", stopOnFirstSet: true });
    expect(r.value).toBe(640); // 800 * 0.8
    const matched = r.trace.filter((t) => t.matched).map((t) => t.rule);
    expect(matched).toEqual(["region-eg", "coupon-20"]); // default superseded
  });

  it("clamps subtracts to zero and preserves audit trail", () => {
    const rules: Rule<Facts>[] = [
      { name: "base", domain: "pricing", priority: 10, evaluate: () => ({ effect: { kind: "set", value: 500 }, reason: "base" }) },
      { name: "big-discount", domain: "coupon", priority: 100, evaluate: () => ({ effect: { kind: "subtract", value: 999 }, reason: "big" }) },
    ];
    const r = runRules(rules, { qty: 1, org: null, country: null }, { initial: 0, currency: "USD" });
    expect(r.value).toBe(0);
    expect(r.trace.find((t) => t.rule === "big-discount")?.matched).toBe(true);
  });

  it("skips supersede'd set rules when stopOnFirstSet=true", () => {
    const rules: Rule<Facts>[] = [
      { name: "contract", domain: "pricing", priority: 10, evaluate: () => ({ effect: { kind: "set", value: 300 }, reason: "" }) },
      { name: "default", domain: "pricing", priority: 90, evaluate: () => ({ effect: { kind: "set", value: 1000 }, reason: "" }) },
    ];
    const r = runRules(rules, { qty: 1, org: null, country: null }, { initial: 0, currency: "USD", stopOnFirstSet: true });
    expect(r.value).toBe(300);
    expect(r.trace.find((t) => t.rule === "default")?.reason).toContain("superseded");
  });
});
