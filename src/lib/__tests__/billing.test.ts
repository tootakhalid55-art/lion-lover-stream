import { describe, it, expect } from "vitest";
import { computeLineTax, formatDocNumber, fiscalYearOf } from "@/lib/billing.server";
import { zatcaQrPayload } from "@/lib/billing-pdf.server";

describe("billing tax math", () => {
  it("computes gross and tax at 15%", () => {
    const r = computeLineTax(1000, 2, 1500); // 2 × $10.00 @ 15%
    expect(r.amountCents).toBe(2000);
    expect(r.taxAmountCents).toBe(300);
  });
  it("zero rate → zero tax", () => {
    const r = computeLineTax(9999, 3, 0);
    expect(r.taxAmountCents).toBe(0);
    expect(r.amountCents).toBe(29997);
  });
  it("handles negative unit price (credit line)", () => {
    const r = computeLineTax(-500, 1, 1500);
    expect(r.amountCents).toBe(-500);
    // Tax rounds symmetrically; sign follows amount
    expect(r.taxAmountCents).toBe(-75);
  });
});

describe("invoice numbering", () => {
  it("formats a tax-invoice number with fiscal year, branch, zero-padded seq", () => {
    const n = formatDocNumber({ docType: "tax_invoice", fiscalYear: 2026, branch: "MAIN", seq: 42 });
    expect(n).toBe("INV-MAIN-2026-000042");
  });
  it("distinguishes credit and debit notes by prefix", () => {
    expect(formatDocNumber({ docType: "credit_note", fiscalYear: 2026, branch: "MAIN", seq: 1 }).startsWith("CN-")).toBe(true);
    expect(formatDocNumber({ docType: "debit_note", fiscalYear: 2026, branch: "MAIN", seq: 1 }).startsWith("DN-")).toBe(true);
    expect(formatDocNumber({ docType: "proforma", fiscalYear: 2026, branch: "MAIN", seq: 1 }).startsWith("PF-")).toBe(true);
  });
  it("current fiscal year is the calendar year in UTC", () => {
    expect(fiscalYearOf(new Date("2026-07-23T00:00:00Z"))).toBe(2026);
  });
});

describe("ZATCA QR payload", () => {
  it("produces a non-empty base64 TLV string", () => {
    const qr = zatcaQrPayload({
      sellerName: "Nova TV",
      vatNumber: "300000000000003",
      timestamp: "2026-07-23T10:00:00Z",
      totalCents: 11500,
      vatCents: 1500,
      currency: "SAR",
    });
    expect(qr.length).toBeGreaterThan(20);
    // base64 alphabet only
    expect(/^[A-Za-z0-9+/=]+$/.test(qr)).toBe(true);
  });
});
