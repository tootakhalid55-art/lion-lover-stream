/**
 * Invoice PDF renderer.
 *
 * We emit a print-optimised HTML document with an embedded ZATCA-shaped
 * QR payload (base64 TLV of seller/vat/timestamp/total/vat_total). The
 * browser Print → Save as PDF pipeline (or headless renderer at hosting
 * layer) produces the final PDF. This keeps the worker runtime lean
 * (no @react-pdf/renderer dependency) and works on every platform Nova
 * is deployed to. Swap in a headless renderer later without touching
 * the engine layer.
 */
import type { DocType, InvoiceSnapshot } from "./billing.server";

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100);

function tlv(tag: number, value: string): string {
  const bytes = new TextEncoder().encode(value);
  const out = new Uint8Array(2 + bytes.length);
  out[0] = tag;
  out[1] = bytes.length;
  out.set(bytes, 2);
  return String.fromCharCode(...out);
}

/** ZATCA Phase-1 simplified TLV QR payload → base64. */
export function zatcaQrPayload(opts: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalCents: number;
  vatCents: number;
  currency: string;
}): string {
  const total = (opts.totalCents / 100).toFixed(2);
  const vat = (opts.vatCents / 100).toFixed(2);
  const raw =
    tlv(1, opts.sellerName) +
    tlv(2, opts.vatNumber) +
    tlv(3, opts.timestamp) +
    tlv(4, total) +
    tlv(5, vat);
  return btoa(raw);
}

const DOC_LABEL: Record<DocType, string> = {
  tax_invoice: "TAX INVOICE",
  simplified_tax_invoice: "SIMPLIFIED TAX INVOICE",
  credit_note: "CREDIT NOTE",
  debit_note: "DEBIT NOTE",
  proforma: "PROFORMA INVOICE",
  renewal_invoice: "RENEWAL INVOICE",
};

export interface InvoiceRenderModel {
  invoice: {
    id: string;
    number: string;
    status: string;
    doc_type: DocType;
    currency: string;
    subtotal_cents: number;
    discount_cents: number;
    tax_cents: number;
    total_cents: number;
    amount_paid_cents: number;
    amount_due_cents: number;
    issued_at: string | null;
    due_at: string | null;
    snapshot: InvoiceSnapshot;
  };
  lines: Array<{
    description: string;
    qty: number;
    unit_price_cents: number;
    amount_cents: number;
    tax_kind: string;
    tax_rate_bps: number;
    tax_amount_cents: number;
  }>;
}

export function renderInvoiceHtml(model: InvoiceRenderModel): string {
  const inv = model.invoice;
  const s = inv.snapshot;
  const label = DOC_LABEL[inv.doc_type];
  const qr = zatcaQrPayload({
    sellerName: s.company.name,
    vatNumber: (s.company as any).vatNumber ?? "000000000000000",
    timestamp: inv.issued_at ?? new Date().toISOString(),
    totalCents: inv.total_cents,
    vatCents: inv.tax_cents,
    currency: inv.currency,
  });
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qr)}`;

  const rowsHtml = model.lines
    .map(
      (l) => `
      <tr>
        <td>${escape(l.description)}</td>
        <td class="num">${l.qty}</td>
        <td class="num">${money(l.unit_price_cents, inv.currency)}</td>
        <td class="num">${money(l.amount_cents, inv.currency)}</td>
        <td class="num">${(l.tax_rate_bps / 100).toFixed(2)}%</td>
        <td class="num">${money(l.tax_amount_cents, inv.currency)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${label} ${escape(inv.number)}</title>
<style>
  :root { --ink:#0b0b0f; --muted:#5b6070; --line:#e6e8ee; --brand:#3EA6FF; }
  * { box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif; color:var(--ink); margin:0; padding:32px; background:#fff; }
  .wrap { max-width:820px; margin:0 auto; }
  header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid var(--brand); padding-bottom:16px; }
  .brand { font-weight:900; font-size:22px; letter-spacing:0.5px; color:var(--brand); }
  .doc { text-align:right; }
  .doc h1 { margin:0; font-size:20px; letter-spacing:2px; }
  .doc .num { color:var(--muted); font-size:13px; }
  .status { display:inline-block; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; text-transform:uppercase; }
  .status.paid { background:#e7f7ee; color:#128a3e; }
  .status.issued, .status.sent { background:#eef4ff; color:#204ea3; }
  .status.overdue { background:#fdecec; color:#c22626; }
  .status.cancelled, .status.refunded { background:#f0f0f4; color:#5b6070; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin:24px 0; }
  .card { border:1px solid var(--line); border-radius:12px; padding:16px; }
  .card h3 { margin:0 0 8px; font-size:11px; text-transform:uppercase; color:var(--muted); letter-spacing:1px; }
  .card p { margin:2px 0; font-size:13px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; font-size:13px; }
  th, td { padding:10px 8px; border-bottom:1px solid var(--line); text-align:left; }
  th { background:#fafbfd; text-transform:uppercase; font-size:10px; color:var(--muted); letter-spacing:1px; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  .totals { margin-left:auto; margin-top:16px; width:320px; font-size:14px; }
  .totals .row { display:flex; justify-content:space-between; padding:6px 0; }
  .totals .grand { border-top:2px solid var(--ink); margin-top:6px; padding-top:10px; font-weight:900; font-size:16px; }
  footer { display:flex; justify-content:space-between; align-items:center; margin-top:32px; padding-top:16px; border-top:1px solid var(--line); font-size:11px; color:var(--muted); }
  .fx { font-size:11px; color:var(--muted); margin-top:4px; }
  @media print { body { padding:12px; } }
</style>
</head><body><div class="wrap">
<header>
  <div>
    <div class="brand">${escape(s.company.brand)}</div>
    <p style="margin:4px 0 0;font-size:12px;color:var(--muted);">Nova TV Streaming Platform</p>
  </div>
  <div class="doc">
    <h1>${label}</h1>
    <div class="num"># ${escape(inv.number)}</div>
    <div style="margin-top:6px"><span class="status ${escape(inv.status)}">${escape(inv.status)}</span></div>
  </div>
</header>

<div class="grid">
  <div class="card">
    <h3>Billed To</h3>
    <p><strong>${escape(s.customer.name)}</strong></p>
    ${s.customer.email ? `<p>${escape(s.customer.email)}</p>` : ""}
    ${s.billingAddress?.line1 ? `<p>${escape(s.billingAddress.line1)}</p>` : ""}
    ${s.billingAddress?.city ? `<p>${escape(s.billingAddress.city)}</p>` : ""}
    ${s.customer.country ? `<p>${escape(s.customer.country)}</p>` : ""}
    ${s.customer.taxId ? `<p>Tax ID: ${escape(s.customer.taxId)}</p>` : ""}
  </div>
  <div class="card" style="display:flex;justify-content:space-between;gap:12px;">
    <div>
      <h3>Invoice Details</h3>
      <p><strong>Issued:</strong> ${escape(inv.issued_at?.slice(0, 10) ?? "-")}</p>
      ${inv.due_at ? `<p><strong>Due:</strong> ${escape(inv.due_at.slice(0, 10))}</p>` : ""}
      <p><strong>Currency:</strong> ${escape(inv.currency)}</p>
      ${s.fx.baseCurrency !== inv.currency ? `<p class="fx">FX ${s.fx.baseCurrency}→${inv.currency} @ ${s.fx.rate}</p>` : ""}
      ${s.reseller?.name ? `<p><strong>Reseller:</strong> ${escape(s.reseller.name)}</p>` : ""}
    </div>
    <img src="${qrSrc}" alt="ZATCA QR" width="120" height="120" style="border:1px solid var(--line);border-radius:8px" />
  </div>
</div>

<table>
  <thead><tr>
    <th>Description</th><th class="num">Qty</th><th class="num">Unit</th>
    <th class="num">Amount</th><th class="num">Tax %</th><th class="num">Tax</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>

<div class="totals">
  <div class="row"><span>Subtotal</span><span>${money(inv.subtotal_cents, inv.currency)}</span></div>
  ${inv.discount_cents ? `<div class="row"><span>Discount</span><span>−${money(inv.discount_cents, inv.currency)}</span></div>` : ""}
  <div class="row"><span>Tax</span><span>${money(inv.tax_cents, inv.currency)}</span></div>
  <div class="row grand"><span>Total</span><span>${money(inv.total_cents, inv.currency)}</span></div>
  ${inv.amount_paid_cents ? `<div class="row"><span>Paid</span><span>−${money(inv.amount_paid_cents, inv.currency)}</span></div>` : ""}
  ${inv.amount_due_cents ? `<div class="row" style="color:#c22626;font-weight:700"><span>Balance Due</span><span>${money(inv.amount_due_cents, inv.currency)}</span></div>` : ""}
</div>

<footer>
  <span>Generated by Nova TV Billing Engine • ${escape(new Date().toISOString().slice(0, 10))}</span>
  <span>ZATCA / Peppol ready</span>
</footer>
</div></body></html>`;
}

function escape(s: string | number | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
