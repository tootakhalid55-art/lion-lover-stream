/**
 * Billing engine internals.
 *
 * This module owns:
 *   - Tax resolution (VAT / zero-rated / exempt / reverse charge)
 *   - FX snapshot resolution
 *   - Document numbering (per org + fiscal year + doc type + branch)
 *   - Immutable invoice snapshot builder
 *   - Double-entry posting (journal_entries + journal_lines)
 *   - Billing event bus (billing_events table)
 *   - Core issue / pay / cancel / credit-note / debit-note primitives
 *
 * Callers (server functions, admin UI, portal, cron) must go through
 * `billing.functions.ts` — never write invoices, journal entries, or
 * numbers from anywhere else. That guarantee is what makes historical
 * invoices immutable and journals balanced.
 */

// --------- TYPES ---------------------------------------------------------

export type DocType =
  | "tax_invoice"
  | "simplified_tax_invoice"
  | "credit_note"
  | "debit_note"
  | "proforma"
  | "renewal_invoice";

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "refunded"
  | "written_off";

export type BillingStrategy = "immediate" | "scheduled" | "recurring" | "usage" | "manual";
export type TaxKind = "vat" | "zero_rated" | "exempt" | "reverse_charge" | "none";
export type LineKind =
  | "subscription"
  | "usage"
  | "license"
  | "credit"
  | "tax"
  | "discount"
  | "adjustment"
  | "renewal"
  | "upgrade"
  | "downgrade";

export interface InvoiceLineInput {
  description: string;
  qty: number;
  unitPriceCents: number;
  kind: LineKind;
  taxKind?: TaxKind;
  ref?: Record<string, unknown>;
}

export interface IssueInvoiceInput {
  orgId: string;
  docType: DocType;
  billingStrategy?: BillingStrategy;
  currency: string;
  baseCurrency?: string;
  lines: InvoiceLineInput[];
  dueAt?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  parentInvoiceId?: string | null;
  branch?: string;
  actorId: string | null;
  meta?: Record<string, unknown>;
}

export interface InvoiceComputed {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  baseTotalCents: number;
  lines: Array<InvoiceLineInput & { amountCents: number; taxAmountCents: number; taxRateBps: number }>;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// --------- TAX ENGINE ----------------------------------------------------

export interface TaxRule {
  country: string;
  region: string | null;
  rate_bps: number;
  kind: string;
  inclusive: boolean;
}

/**
 * Resolve the effective tax rate for an org + tax kind combo.
 * Zero-rated / exempt / reverse-charge return 0 rate but keep the
 * document flag so PDF + ZATCA export can render the right label.
 */
export async function resolveTax(opts: {
  orgId: string;
  taxKind: TaxKind;
}): Promise<{ rateBps: number; kind: TaxKind; rule: TaxRule | null }> {
  const { taxKind } = opts;
  if (taxKind === "zero_rated" || taxKind === "exempt" || taxKind === "reverse_charge" || taxKind === "none") {
    return { rateBps: 0, kind: taxKind, rule: null };
  }
  const sb = await admin();
  const { data: org } = await sb.from("organizations").select("country").eq("id", opts.orgId).maybeSingle();
  const country = (org?.country as string | undefined) ?? "SA";
  const { data } = await sb
    .from("tax_rules")
    .select("country,region,rate_bps,kind,inclusive")
    .eq("country", country)
    .eq("kind", "vat")
    .order("created_at", { ascending: false })
    .limit(1);
  const rule = (data?.[0] as TaxRule | undefined) ?? null;
  return { rateBps: rule?.rate_bps ?? 0, kind: "vat", rule };
}

/** Pure math — kept exported for the test suite. */
export function computeLineTax(unitPriceCents: number, qty: number, rateBps: number): { amountCents: number; taxAmountCents: number } {
  const gross = Math.round(unitPriceCents * qty);
  const tax = Math.round((gross * rateBps) / 10_000);
  return { amountCents: gross, taxAmountCents: tax };
}

// --------- FX ENGINE -----------------------------------------------------

/** Get the newest rate for a currency pair, else 1 for same-currency. */
export async function getFxRate(base: string, quote: string): Promise<number> {
  if (base === quote) return 1;
  const sb = await admin();
  const { data } = await sb
    .from("fx_rates")
    .select("rate")
    .eq("base_currency", base)
    .eq("quote_currency", quote)
    .order("effective_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  return row ? Number(row.rate) : 1;
}

// --------- NUMBERING ENGINE ---------------------------------------------

export function fiscalYearOf(date = new Date()): number {
  return date.getUTCFullYear();
}

function docPrefix(docType: DocType): string {
  switch (docType) {
    case "tax_invoice": return "INV";
    case "simplified_tax_invoice": return "SIV";
    case "credit_note": return "CN";
    case "debit_note": return "DN";
    case "proforma": return "PF";
    case "renewal_invoice": return "REN";
  }
}

export function formatDocNumber(opts: { docType: DocType; fiscalYear: number; branch: string; seq: number }): string {
  const seqStr = String(opts.seq).padStart(6, "0");
  return `${docPrefix(opts.docType)}-${opts.branch}-${opts.fiscalYear}-${seqStr}`;
}

export async function nextDocNumber(opts: { orgId: string; docType: DocType; branch?: string; fiscalYear?: number }): Promise<string> {
  const sb = await admin();
  const fy = opts.fiscalYear ?? fiscalYearOf();
  const branch = opts.branch ?? "MAIN";
  const { data, error } = await sb.rpc("next_doc_number", {
    _org: opts.orgId,
    _fiscal_year: fy,
    _doc_type: opts.docType,
    _branch: branch,
  });
  if (error) throw error;
  const seq = Number(data);
  return formatDocNumber({ docType: opts.docType, fiscalYear: fy, branch, seq });
}

// --------- SNAPSHOT BUILDER ---------------------------------------------

export interface InvoiceSnapshot {
  company: { name: string; brand: string; logoUrl: string | null };
  customer: { orgId: string; name: string; email: string | null; address: string | null; country: string | null; taxId: string | null };
  reseller: { orgId: string | null; name: string | null } | null;
  pricingTrace: unknown | null;
  taxSummary: { totalTaxCents: number; kinds: Record<string, { rateBps: number; taxCents: number }> };
  fx: { baseCurrency: string; billingCurrency: string; rate: number; snapshotAt: string };
  billingAddress: { line1: string | null; city: string | null; country: string | null } | null;
  meta: Record<string, unknown>;
}

export async function buildSnapshot(opts: {
  orgId: string;
  computed: InvoiceComputed;
  currency: string;
  baseCurrency: string;
  fxRate: number;
  pricingTrace?: unknown | null;
  extraMeta?: Record<string, unknown>;
}): Promise<InvoiceSnapshot> {
  const sb = await admin();
  const { data: org } = await sb
    .from("organizations")
    .select("id, name, country, parent_id, meta")
    .eq("id", opts.orgId)
    .maybeSingle();
  const { data: profile } = await sb
    .from("reseller_profiles")
    .select("company_name, email, address, tax_profile")
    .eq("org_id", opts.orgId)
    .maybeSingle();
  const reseller = org?.parent_id
    ? await sb.from("organizations").select("id, name").eq("id", org.parent_id).maybeSingle().then((r) => r.data)
    : null;

  const kinds: Record<string, { rateBps: number; taxCents: number }> = {};
  let totalTax = 0;
  for (const l of opts.computed.lines) {
    const k = l.taxKind ?? "none";
    if (!kinds[k]) kinds[k] = { rateBps: l.taxRateBps, taxCents: 0 };
    kinds[k].taxCents += l.taxAmountCents;
    totalTax += l.taxAmountCents;
  }

  return {
    company: { name: "Nova TV", brand: "Nova TV", logoUrl: null },
    customer: {
      orgId: opts.orgId,
      name: (profile?.company_name as string) ?? org?.name ?? "Customer",
      email: (profile?.email as string) ?? null,
      address: profile?.address ? JSON.stringify(profile.address) : null,
      country: org?.country ?? null,
      taxId: (profile?.tax_profile as any)?.tax_id ?? null,
    },
    reseller: reseller ? { orgId: reseller.id, name: reseller.name } : null,
    pricingTrace: opts.pricingTrace ?? null,
    taxSummary: { totalTaxCents: totalTax, kinds },
    fx: {
      baseCurrency: opts.baseCurrency,
      billingCurrency: opts.currency,
      rate: opts.fxRate,
      snapshotAt: new Date().toISOString(),
    },
    billingAddress: profile?.address
      ? {
          line1: (profile.address as any)?.line1 ?? null,
          city: (profile.address as any)?.city ?? null,
          country: (profile.address as any)?.country ?? org?.country ?? null,
        }
      : null,
    meta: opts.extraMeta ?? {},
  };
}

// --------- POSTING ENGINE (double-entry journal) ------------------------

export interface JournalLineInput {
  account: string;
  side: "debit" | "credit";
  amountCents: number;
  memo?: string;
  meta?: Record<string, unknown>;
}

export async function postJournal(opts: {
  orgId: string;
  eventType: string;
  refType: string;
  refId: string;
  currency: string;
  memo?: string;
  lines: JournalLineInput[];
  meta?: Record<string, unknown>;
}): Promise<{ entryId: string }> {
  const totalDebit = opts.lines.filter((l) => l.side === "debit").reduce((a, l) => a + l.amountCents, 0);
  const totalCredit = opts.lines.filter((l) => l.side === "credit").reduce((a, l) => a + l.amountCents, 0);
  if (totalDebit !== totalCredit) {
    throw new Error(`Unbalanced journal entry: debit=${totalDebit} credit=${totalCredit}`);
  }
  const sb = await admin();
  const { data: entry, error } = await sb
    .from("journal_entries")
    .insert({
      org_id: opts.orgId,
      event_type: opts.eventType,
      ref_type: opts.refType,
      ref_id: opts.refId,
      memo: opts.memo ?? null,
      currency: opts.currency,
      total_debit_cents: totalDebit,
      total_credit_cents: totalCredit,
      meta: (opts.meta ?? {}) as any,
    })
    .select("id")
    .single();
  if (error || !entry) throw error ?? new Error("Journal entry insert failed");
  const rows = opts.lines.map((l) => ({
    entry_id: entry.id,
    account: l.account,
    side: l.side,
    amount_cents: l.amountCents,
    memo: l.memo ?? null,
    meta: (l.meta ?? {}) as any,
  }));
  const { error: lineErr } = await sb.from("journal_lines").insert(rows);
  if (lineErr) throw lineErr;
  return { entryId: entry.id };
}

// --------- EVENT BUS -----------------------------------------------------

export type BillingEventType =
  | "InvoiceIssued"
  | "InvoicePaid"
  | "InvoicePartiallyPaid"
  | "InvoiceCancelled"
  | "InvoiceRefunded"
  | "InvoiceOverdue"
  | "InvoiceWrittenOff"
  | "CreditNoteIssued"
  | "DebitNoteIssued";

export async function publishBillingEvent(opts: {
  orgId: string;
  type: BillingEventType;
  refType: string;
  refId: string;
  payload?: Record<string, unknown>;
  actorId?: string | null;
}): Promise<void> {
  const sb = await admin();
  await sb.from("billing_events").insert({
    org_id: opts.orgId,
    event_type: opts.type,
    ref_type: opts.refType,
    ref_id: opts.refId,
    payload: (opts.payload ?? {}) as any,
    actor_id: opts.actorId ?? null,
    processed_at: null,
  });
}

// --------- INVOICE COMPUTE ----------------------------------------------

/** Pure computation over lines. Exported for tests. */
export async function computeInvoice(opts: {
  orgId: string;
  lines: InvoiceLineInput[];
  currency: string;
  baseCurrency: string;
  fxRate: number;
}): Promise<InvoiceComputed> {
  const out: InvoiceComputed = {
    subtotalCents: 0,
    discountCents: 0,
    taxCents: 0,
    totalCents: 0,
    baseTotalCents: 0,
    lines: [],
  };
  for (const raw of opts.lines) {
    const taxKind = raw.taxKind ?? "vat";
    const { rateBps } = await resolveTax({ orgId: opts.orgId, taxKind });
    const { amountCents, taxAmountCents } = computeLineTax(raw.unitPriceCents, raw.qty, rateBps);
    if (raw.kind === "discount") out.discountCents += Math.abs(amountCents);
    else out.subtotalCents += amountCents;
    out.taxCents += taxAmountCents;
    out.lines.push({ ...raw, taxKind, amountCents, taxAmountCents, taxRateBps: rateBps });
  }
  out.totalCents = out.subtotalCents - out.discountCents + out.taxCents;
  out.baseTotalCents = Math.round(out.totalCents * opts.fxRate);
  return out;
}

// --------- ISSUE / STATE TRANSITIONS ------------------------------------

export async function issueInvoice(input: IssueInvoiceInput): Promise<{ invoiceId: string; number: string }> {
  const baseCurrency = input.baseCurrency ?? input.currency;
  const fxRate = await getFxRate(input.currency, baseCurrency);
  const computed = await computeInvoice({
    orgId: input.orgId,
    lines: input.lines,
    currency: input.currency,
    baseCurrency,
    fxRate,
  });
  const number = await nextDocNumber({ orgId: input.orgId, docType: input.docType, branch: input.branch });
  const snapshot = await buildSnapshot({
    orgId: input.orgId,
    computed,
    currency: input.currency,
    baseCurrency,
    fxRate,
    pricingTrace: (input.meta as any)?.pricing_trace ?? null,
    extraMeta: input.meta ?? {},
  });

  const sb = await admin();
  const now = new Date().toISOString();
  const { data: inv, error } = await sb
    .from("invoices")
    .insert({
      org_id: input.orgId,
      number,
      status: "issued",
      doc_type: input.docType,
      currency: input.currency,
      base_currency: baseCurrency,
      fx_rate: fxRate,
      subtotal_cents: computed.subtotalCents,
      tax_cents: computed.taxCents,
      discount_cents: computed.discountCents,
      total_cents: computed.totalCents,
      base_total_cents: computed.baseTotalCents,
      amount_paid_cents: 0,
      amount_due_cents: computed.totalCents,
      billing_strategy: input.billingStrategy ?? "immediate",
      parent_invoice_id: input.parentInvoiceId ?? null,
      source_type: input.sourceType ?? null,
      source_id: input.sourceId ?? null,
      due_at: input.dueAt ?? null,
      issued_at: now,
      snapshot: snapshot as any,
      meta: (input.meta ?? {}) as any,
    })
    .select("id, number")
    .single();
  if (error || !inv) throw error ?? new Error("Invoice insert failed");

  const lineRows = computed.lines.map((l) => ({
    invoice_id: inv.id,
    description: l.description,
    qty: l.qty,
    unit_price_cents: l.unitPriceCents,
    amount_cents: l.amountCents,
    kind: l.kind,
    tax_kind: l.taxKind,
    tax_rate_bps: l.taxRateBps,
    tax_amount_cents: l.taxAmountCents,
    ref: (l.ref ?? {}) as any,
  }));
  await sb.from("invoice_lines").insert(lineRows);

  // Posting: AR debit; revenue + tax payable credits
  const revenueCents = computed.subtotalCents - computed.discountCents;
  if (computed.totalCents > 0) {
    await postJournal({
      orgId: input.orgId,
      eventType: input.docType === "credit_note" ? "CreditNoteIssued" : "InvoiceIssued",
      refType: "invoice",
      refId: inv.id,
      currency: input.currency,
      memo: number,
      lines: [
        { account: "accounts_receivable", side: "debit", amountCents: computed.totalCents },
        { account: "revenue", side: "credit", amountCents: revenueCents },
        { account: "tax_payable", side: "credit", amountCents: computed.taxCents },
      ],
    });
  }

  const eventType: BillingEventType =
    input.docType === "credit_note" ? "CreditNoteIssued"
    : input.docType === "debit_note" ? "DebitNoteIssued"
    : "InvoiceIssued";
  await publishBillingEvent({
    orgId: input.orgId,
    type: eventType,
    refType: "invoice",
    refId: inv.id,
    payload: { number, total_cents: computed.totalCents, currency: input.currency },
    actorId: input.actorId,
  });

  return { invoiceId: inv.id, number: inv.number };
}

export async function markInvoicePaid(opts: {
  invoiceId: string;
  amountCents: number;
  gateway: "stripe" | "moyasar" | "hyperpay" | "paytabs" | "manual" | "wallet";
  gatewayRef?: string | null;
  actorId: string | null;
}): Promise<void> {
  const sb = await admin();
  const { data: inv } = await sb.from("invoices").select("*").eq("id", opts.invoiceId).maybeSingle();
  if (!inv) throw new Error("Invoice not found");
  const newPaid = (inv.amount_paid_cents ?? 0) + opts.amountCents;
  const remaining = Math.max(0, (inv.total_cents ?? 0) - newPaid);
  const status: InvoiceStatus = remaining === 0 ? "paid" : "partially_paid";

  await sb.from("payments").insert({
    invoice_id: inv.id,
    org_id: inv.org_id,
    gateway: opts.gateway,
    gateway_ref: opts.gatewayRef ?? null,
    status: "succeeded",
    amount_cents: opts.amountCents,
    currency: inv.currency,
  });

  await sb
    .from("invoices")
    .update({
      amount_paid_cents: newPaid,
      amount_due_cents: remaining,
      status,
      paid_at: status === "paid" ? new Date().toISOString() : inv.paid_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inv.id);

  // Posting: cash debit; AR credit (or bank clearing account per gateway)
  const cashAccount = opts.gateway === "wallet" ? "wallet_clearing" : `bank_${opts.gateway}`;
  await postJournal({
    orgId: inv.org_id,
    eventType: status === "paid" ? "InvoicePaid" : "InvoicePartiallyPaid",
    refType: "invoice",
    refId: inv.id,
    currency: inv.currency,
    memo: inv.number,
    lines: [
      { account: cashAccount, side: "debit", amountCents: opts.amountCents },
      { account: "accounts_receivable", side: "credit", amountCents: opts.amountCents },
    ],
  });

  await publishBillingEvent({
    orgId: inv.org_id,
    type: status === "paid" ? "InvoicePaid" : "InvoicePartiallyPaid",
    refType: "invoice",
    refId: inv.id,
    payload: { amount: opts.amountCents, gateway: opts.gateway, remaining_cents: remaining },
    actorId: opts.actorId,
  });
}

export async function cancelInvoice(opts: { invoiceId: string; reason?: string; actorId: string | null }): Promise<void> {
  const sb = await admin();
  const { data: inv } = await sb.from("invoices").select("*").eq("id", opts.invoiceId).maybeSingle();
  if (!inv) throw new Error("Invoice not found");
  if (["paid", "refunded", "cancelled"].includes(inv.status as string)) {
    throw new Error(`Cannot cancel invoice in status ${inv.status}`);
  }
  await sb
    .from("invoices")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      meta: { ...(inv.meta as any), cancel_reason: opts.reason ?? null },
      updated_at: new Date().toISOString(),
    })
    .eq("id", inv.id);

  // Reverse the issue journal (if any)
  if ((inv.total_cents ?? 0) > 0) {
    const revenueCents = (inv.subtotal_cents ?? 0) - (inv.discount_cents ?? 0);
    await postJournal({
      orgId: inv.org_id,
      eventType: "InvoiceCancelled",
      refType: "invoice",
      refId: inv.id,
      currency: inv.currency,
      memo: `Cancel ${inv.number}`,
      lines: [
        { account: "revenue", side: "debit", amountCents: revenueCents },
        { account: "tax_payable", side: "debit", amountCents: inv.tax_cents ?? 0 },
        { account: "accounts_receivable", side: "credit", amountCents: inv.total_cents ?? 0 },
      ],
    });
  }
  await publishBillingEvent({
    orgId: inv.org_id,
    type: "InvoiceCancelled",
    refType: "invoice",
    refId: inv.id,
    payload: { reason: opts.reason ?? null },
    actorId: opts.actorId,
  });
}

export async function issueCreditNote(opts: {
  parentInvoiceId: string;
  reason: string;
  actorId: string | null;
}): Promise<{ invoiceId: string; number: string }> {
  const sb = await admin();
  const { data: parent } = await sb.from("invoices").select("*").eq("id", opts.parentInvoiceId).maybeSingle();
  if (!parent) throw new Error("Parent invoice not found");
  const { data: lines } = await sb.from("invoice_lines").select("*").eq("invoice_id", parent.id);

  const cnLines: InvoiceLineInput[] = (lines ?? []).map((l: any) => ({
    description: `Credit: ${l.description}`,
    qty: Number(l.qty),
    // Negative unit price → credit
    unitPriceCents: -Math.abs(l.unit_price_cents),
    kind: l.kind === "tax" ? "adjustment" : (l.kind as LineKind),
    taxKind: l.tax_kind as TaxKind,
    ref: l.ref ?? {},
  }));

  const result = await issueInvoice({
    orgId: parent.org_id,
    docType: "credit_note",
    currency: parent.currency,
    baseCurrency: parent.base_currency,
    lines: cnLines,
    parentInvoiceId: parent.id,
    sourceType: "invoice",
    sourceId: parent.id,
    actorId: opts.actorId,
    meta: { reason: opts.reason, credited_of: parent.number },
  });

  // Mark parent refunded if fully credited
  const refundTotal = Math.abs((parent.total_cents ?? 0));
  await sb
    .from("invoices")
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("id", parent.id);
  await publishBillingEvent({
    orgId: parent.org_id,
    type: "InvoiceRefunded",
    refType: "invoice",
    refId: parent.id,
    payload: { credit_note_id: result.invoiceId, amount_cents: refundTotal },
    actorId: opts.actorId,
  });
  return result;
}

export async function issueDebitNote(opts: {
  parentInvoiceId: string;
  extraLines: InvoiceLineInput[];
  reason: string;
  actorId: string | null;
}): Promise<{ invoiceId: string; number: string }> {
  const sb = await admin();
  const { data: parent } = await sb.from("invoices").select("*").eq("id", opts.parentInvoiceId).maybeSingle();
  if (!parent) throw new Error("Parent invoice not found");
  return issueInvoice({
    orgId: parent.org_id,
    docType: "debit_note",
    currency: parent.currency,
    baseCurrency: parent.base_currency,
    lines: opts.extraLines,
    parentInvoiceId: parent.id,
    sourceType: "invoice",
    sourceId: parent.id,
    actorId: opts.actorId,
    meta: { reason: opts.reason, related_to: parent.number },
  });
}

/** Called by the orders module when a license order flips to `paid`. */
export async function issueInvoiceForOrder(opts: {
  orderId: string;
  actorId: string | null;
}): Promise<{ invoiceId: string; number: string } | null> {
  const sb = await admin();
  const { data: order } = await sb.from("license_orders").select("*").eq("id", opts.orderId).maybeSingle();
  if (!order) throw new Error("Order not found");

  // Idempotency — one invoice per order
  const { data: existing } = await sb
    .from("invoices")
    .select("id, number")
    .eq("source_type", "license_order")
    .eq("source_id", order.id)
    .maybeSingle();
  if (existing) return { invoiceId: existing.id as string, number: existing.number as string };

  const { data: pkg } = await sb.from("packages").select("name").eq("id", order.package_id).maybeSingle();
  const lines: InvoiceLineInput[] = [{
    description: `License: ${pkg?.name ?? "Package"} × ${order.qty}`,
    qty: order.qty,
    // Prices in orders are stored ex-tax; the tax engine will add VAT.
    unitPriceCents: order.unit_price_cents,
    kind: "license",
    taxKind: "vat",
    ref: { order_id: order.id, package_id: order.package_id },
  }];
  if ((order.discount_cents ?? 0) > 0) {
    lines.push({
      description: "Order discount",
      qty: 1,
      unitPriceCents: -Math.abs(order.discount_cents),
      kind: "discount",
      taxKind: "none",
    });
  }
  const result = await issueInvoice({
    orgId: order.org_id,
    docType: "tax_invoice",
    billingStrategy: "immediate",
    currency: order.currency,
    lines,
    sourceType: "license_order",
    sourceId: order.id,
    actorId: opts.actorId,
    meta: { pricing_trace: order.pricing_trace },
  });

  // Wallet has already captured the order total → mark invoice paid via wallet
  await markInvoicePaid({
    invoiceId: result.invoiceId,
    amountCents: order.total_cents,
    gateway: "wallet",
    gatewayRef: `order:${order.id}`,
    actorId: opts.actorId,
  });

  return result;
}
