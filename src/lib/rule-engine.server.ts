/**
 * Generic rule engine used by pricing, promotions, coupons, commissions,
 * tax, approvals, and subscription upgrades. Rules are pure functions over
 * a `Facts` bag that either produce a `RuleEffect` or skip.
 *
 * The engine records a `RuleTrace[]` for every evaluation so support and
 * audit can replay any pricing/commission decision.
 */

export type RuleDomain =
  | "pricing"
  | "promotion"
  | "coupon"
  | "commission"
  | "tax"
  | "approval"
  | "upgrade";

export interface RuleEffect {
  /** How this rule mutated the working value. */
  kind: "set" | "add" | "subtract" | "multiply" | "annotate";
  /** Cents (for money) or a bps/percent (for percent rules). */
  value: number;
  /** Meta captured for audit (e.g. `{ percent: 20 }`). */
  meta?: Record<string, unknown>;
}

export interface RuleTrace {
  rule: string;
  domain: RuleDomain;
  priority: number;
  matched: boolean;
  before: number;
  after: number;
  effect?: RuleEffect;
  reason: string;
  meta?: Record<string, unknown>;
}

export interface Rule<F> {
  name: string;
  domain: RuleDomain;
  /** Lower number wins first. Pricing priority order matches spec. */
  priority: number;
  /** Return `null` to skip, or an effect + human reason. */
  evaluate: (facts: F, current: number) => { effect: RuleEffect; reason: string; meta?: Record<string, unknown> } | null;
}

export interface RuleResult {
  value: number;
  trace: RuleTrace[];
  currency: string;
}

/** Priority tiers used by pricing (lower = evaluated first). */
export const PRICING_PRIORITY = {
  contract: 10,
  promotional: 20,
  reseller: 30,
  regional: 40,
  default: 90,
} as const;

function apply(current: number, e: RuleEffect): number {
  switch (e.kind) {
    case "set": return Math.round(e.value);
    case "add": return Math.round(current + e.value);
    case "subtract": return Math.max(0, Math.round(current - e.value));
    case "multiply": return Math.max(0, Math.round(current * e.value));
    case "annotate": return current;
  }
}

/**
 * Run rules in priority order. `stopOnFirstSet` mirrors the pricing spec:
 * once a `set` rule (base price) matches, later `set` rules are ignored but
 * additive/subtractive modifiers still apply.
 */
export function runRules<F>(rules: Rule<F>[], facts: F, opts: {
  initial: number;
  currency: string;
  stopOnFirstSet?: boolean;
}): RuleResult {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  let value = opts.initial;
  let baseSet = false;
  const trace: RuleTrace[] = [];
  for (const rule of sorted) {
    const before = value;
    const out = rule.evaluate(facts, value);
    if (!out) {
      trace.push({ rule: rule.name, domain: rule.domain, priority: rule.priority, matched: false, before, after: before, reason: "skipped" });
      continue;
    }
    if (out.effect.kind === "set" && baseSet && opts.stopOnFirstSet) {
      trace.push({ rule: rule.name, domain: rule.domain, priority: rule.priority, matched: false, before, after: before, effect: out.effect, reason: `superseded by earlier base price` });
      continue;
    }
    value = apply(value, out.effect);
    if (out.effect.kind === "set") baseSet = true;
    trace.push({ rule: rule.name, domain: rule.domain, priority: rule.priority, matched: true, before, after: value, effect: out.effect, reason: out.reason, meta: out.meta });
  }
  return { value, trace, currency: opts.currency };
}
