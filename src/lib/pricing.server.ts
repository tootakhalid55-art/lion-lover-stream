/**
 * Pricing engine — resolves a final unit price for a `(package, org, qty, at)`
 * tuple using the rule engine. Returns the final price + a full pricing trace.
 *
 * Priority (lower first):
 *   contract (org-scoped, no promo dates) → promotional (org or default with
 *   promo window) → reseller (walks up ancestor orgs) → regional (country)
 *   → default (no org, no region).
 *
 * Extras applied after base price:
 *   - discount_pct on the winning row
 *   - margin_pct on the winning row
 *   - quantity break rules (from `meta.quantity_breaks` on the row)
 *   - promo code (percent / amount) if provided
 *   - currency conversion via `tax_rules`-style FX in `meta` (deferred; identity for now)
 */
import { PRICING_PRIORITY, type Rule, type RuleResult, runRules } from "./rule-engine.server";
import { orgAncestors } from "./tenancy.server";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface PriceFacts {
  packageId: string;
  orgId: string | null;
  ancestors: string[];
  country: string | null;
  qty: number;
  at: Date;
  currency: string;
  promoCode?: string | null;
}

export interface PricingRow {
  id: string;
  package_id: string;
  org_id: string | null;
  price_cents: number;
  currency: string;
  region: string | null;
  discount_pct: number;
  margin_pct: number;
  promo_starts_at: string | null;
  promo_ends_at: string | null;
  effective_from: string;
  effective_to: string | null;
  visible: boolean;
  meta?: Record<string, unknown>;
}

interface PromoRow {
  id: string;
  code: string;
  kind: "percent" | "amount" | "credits";
  value: number;
  currency: string | null;
  package_id: string | null;
  org_id: string | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
}

function inWindow(row: { effective_from: string; effective_to: string | null }, at: Date): boolean {
  const from = new Date(row.effective_from).getTime();
  if (from > at.getTime()) return false;
  if (row.effective_to && new Date(row.effective_to).getTime() < at.getTime()) return false;
  return true;
}

function inPromoWindow(row: PricingRow, at: Date): boolean {
  if (!row.promo_starts_at && !row.promo_ends_at) return false;
  const t = at.getTime();
  if (row.promo_starts_at && new Date(row.promo_starts_at).getTime() > t) return false;
  if (row.promo_ends_at && new Date(row.promo_ends_at).getTime() < t) return false;
  return true;
}

function buildRules(rows: PricingRow[], facts: PriceFacts, promo: PromoRow | null): Rule<PriceFacts>[] {
  const rules: Rule<PriceFacts>[] = [];

  const active = rows.filter((r) => r.visible && inWindow(r, facts.at));

  // 1. Contract — org-scoped, no promo window, closest ancestor wins
  const contract = active.find(
    (r) => r.org_id && facts.ancestors.includes(r.org_id) && !inPromoWindow(r, facts.at) && (r.meta as any)?.kind === "contract",
  );
  if (contract) {
    rules.push({
      name: `contract:${contract.id}`,
      domain: "pricing",
      priority: PRICING_PRIORITY.contract,
      evaluate: () => ({
        effect: { kind: "set", value: contract.price_cents, meta: { rowId: contract.id, org_id: contract.org_id } },
        reason: "Contract price",
      }),
    });
  }

  // 2. Promotional — active promo window
  const promoRow = active
    .filter((r) => inPromoWindow(r, facts.at))
    .sort((a, b) => a.price_cents - b.price_cents)[0];
  if (promoRow) {
    rules.push({
      name: `promo:${promoRow.id}`,
      domain: "pricing",
      priority: PRICING_PRIORITY.promotional,
      evaluate: () => ({
        effect: { kind: "set", value: promoRow.price_cents, meta: { rowId: promoRow.id } },
        reason: "Promotional price",
      }),
    });
  }

  // 3. Reseller — org-scoped, closest ancestor wins
  const resellerRow = facts.ancestors
    .map((orgId) => active.find((r) => r.org_id === orgId && !inPromoWindow(r, facts.at) && (r.meta as any)?.kind !== "contract"))
    .find(Boolean);
  if (resellerRow) {
    rules.push({
      name: `reseller:${resellerRow.id}`,
      domain: "pricing",
      priority: PRICING_PRIORITY.reseller,
      evaluate: () => ({
        effect: { kind: "set", value: resellerRow.price_cents, meta: { rowId: resellerRow.id, org_id: resellerRow.org_id } },
        reason: "Reseller price list",
      }),
    });
  }

  // 4. Regional — matches country
  const regionRow = active.find((r) => r.region && facts.country && r.region.toLowerCase() === facts.country.toLowerCase() && !r.org_id);
  if (regionRow) {
    rules.push({
      name: `region:${regionRow.id}`,
      domain: "pricing",
      priority: PRICING_PRIORITY.regional,
      evaluate: () => ({
        effect: { kind: "set", value: regionRow.price_cents, meta: { rowId: regionRow.id, region: regionRow.region } },
        reason: `Regional price (${regionRow.region})`,
      }),
    });
  }

  // 5. Default — no org, no region
  const defaultRow = active.find((r) => !r.org_id && !r.region);
  if (defaultRow) {
    rules.push({
      name: `default:${defaultRow.id}`,
      domain: "pricing",
      priority: PRICING_PRIORITY.default,
      evaluate: () => ({
        effect: { kind: "set", value: defaultRow.price_cents, meta: { rowId: defaultRow.id } },
        reason: "Default price",
      }),
    });
  }

  // Additive modifiers, applied on top of whichever base wins
  const winning = contract ?? promoRow ?? resellerRow ?? regionRow ?? defaultRow;
  if (winning) {
    if (winning.discount_pct > 0) {
      rules.push({
        name: `discount:${winning.id}`,
        domain: "pricing",
        priority: 100,
        evaluate: (_f, cur) => ({
          effect: { kind: "multiply", value: 1 - winning.discount_pct / 100, meta: { pct: winning.discount_pct } },
          reason: `Row discount ${winning.discount_pct}%`,
        }),
      });
    }
    if (winning.margin_pct > 0) {
      rules.push({
        name: `margin:${winning.id}`,
        domain: "pricing",
        priority: 110,
        evaluate: (_f, _cur) => ({
          effect: { kind: "multiply", value: 1 + winning.margin_pct / 100, meta: { pct: winning.margin_pct } },
          reason: `Reseller margin +${winning.margin_pct}%`,
        }),
      });
    }
    // Quantity breaks from meta: [{ min_qty, discount_pct }]
    const breaks = ((winning.meta as any)?.quantity_breaks ?? []) as Array<{ min_qty: number; discount_pct: number }>;
    const bestBreak = breaks
      .filter((b) => facts.qty >= b.min_qty)
      .sort((a, b) => b.min_qty - a.min_qty)[0];
    if (bestBreak) {
      rules.push({
        name: `qty-break:${bestBreak.min_qty}`,
        domain: "pricing",
        priority: 120,
        evaluate: () => ({
          effect: { kind: "multiply", value: 1 - bestBreak.discount_pct / 100, meta: bestBreak },
          reason: `Quantity break ≥${bestBreak.min_qty} (-${bestBreak.discount_pct}%)`,
        }),
      });
    }
  }

  // Promo/coupon code
  if (promo) {
    rules.push({
      name: `coupon:${promo.code}`,
      domain: "coupon",
      priority: 200,
      evaluate: (_f, cur) => {
        if (promo.kind === "percent") {
          return { effect: { kind: "multiply", value: 1 - promo.value / 100, meta: { code: promo.code } }, reason: `Coupon ${promo.code} -${promo.value}%` };
        }
        if (promo.kind === "amount") {
          return { effect: { kind: "subtract", value: Math.round(promo.value * 100), meta: { code: promo.code } }, reason: `Coupon ${promo.code} -${promo.value}` };
        }
        return null; // 'credits' handled by wallet, not price
      },
    });
  }

  return rules;
}

export interface PriceQuote {
  packageId: string;
  qty: number;
  currency: string;
  unitPriceCents: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  trace: RuleResult["trace"];
  fallback?: boolean;
}

export async function resolvePrice(input: {
  packageId: string;
  orgId?: string | null;
  qty?: number;
  at?: Date;
  currency?: string;
  country?: string | null;
  promoCode?: string | null;
}): Promise<PriceQuote> {
  const admin = await getAdmin();
  const qty = Math.max(1, input.qty ?? 1);
  const at = input.at ?? new Date();

  const [{ data: pkg }, { data: pricing }] = await Promise.all([
    admin.from("packages").select("id, price_cents, currency").eq("id", input.packageId).maybeSingle(),
    admin.from("package_pricing").select("*").eq("package_id", input.packageId),
  ]);
  if (!pkg) throw new Error("Package not found");

  const ancestors = input.orgId ? await orgAncestors(input.orgId) : [];
  const currency = input.currency ?? pkg.currency ?? "USD";

  let promo: PromoRow | null = null;
  if (input.promoCode) {
    const { data } = await admin.from("promo_codes").select("*").eq("code", input.promoCode).maybeSingle();
    if (data) {
      const notExpired = !data.expires_at || new Date(data.expires_at).getTime() > at.getTime();
      const usable = data.max_uses == null || data.used_count < data.max_uses;
      const pkgOk = !data.package_id || data.package_id === input.packageId;
      const orgOk = !data.org_id || ancestors.includes(data.org_id);
      if (notExpired && usable && pkgOk && orgOk) promo = data as PromoRow;
    }
  }

  const facts: PriceFacts = {
    packageId: input.packageId,
    orgId: input.orgId ?? null,
    ancestors,
    country: input.country ?? null,
    qty,
    at,
    currency,
    promoCode: input.promoCode ?? null,
  };

  const rows = (pricing ?? []) as PricingRow[];
  const rules = buildRules(rows, facts, promo);

  // Seed with package fallback price so we always have a base
  const seedRule: Rule<PriceFacts> = {
    name: "package:base",
    domain: "pricing",
    priority: PRICING_PRIORITY.default + 1,
    evaluate: () => ({
      effect: { kind: "set", value: pkg.price_cents, meta: { packageId: pkg.id } },
      reason: "Package fallback price",
    }),
  };
  const result = runRules([...rules, seedRule], facts, { initial: 0, currency, stopOnFirstSet: true });

  const unitPriceCents = result.value;
  const subtotalCents = unitPriceCents * qty;
  // Discount = difference between highest base and final unit price × qty (informational)
  const bases = result.trace.filter((t) => t.matched && t.effect?.kind === "set").map((t) => t.after);
  const gross = bases.length > 0 ? Math.max(...bases) * qty : subtotalCents;
  const discountCents = Math.max(0, gross - subtotalCents);

  return {
    packageId: input.packageId,
    qty,
    currency,
    unitPriceCents,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents, // tax added by billing engine (Step 5)
    trace: result.trace,
    fallback: rows.length === 0,
  };
}
