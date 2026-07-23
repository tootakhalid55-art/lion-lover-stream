/**
 * Billing engine — public server-fn surface consumed by admin, portal,
 * reseller, and (in Step 6) the REST API.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability } from "./rbac.server";
import { assertTenantAccess, visibleOrgIds } from "./tenancy.server";
import { writeAudit } from "./audit.server";
import {
  issueInvoice,
  markInvoicePaid,
  cancelInvoice,
  issueCreditNote,
  issueDebitNote,
  issueInvoiceForOrder,
  type DocType,
  type BillingStrategy,
  type InvoiceLineInput,
  type TaxKind,
  type LineKind,
} from "./billing.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const issueInvoiceManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    orgId: string;
    docType?: DocType;
    billingStrategy?: BillingStrategy;
    currency: string;
    baseCurrency?: string;
    lines: Array<{ description: string; qty: number; unitPriceCents: number; kind: LineKind; taxKind?: TaxKind }>;
    dueAt?: string | null;
    branch?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageBilling");
    await assertTenantAccess(context, data.orgId);
    const result = await issueInvoice({
      orgId: data.orgId,
      docType: data.docType ?? "tax_invoice",
      billingStrategy: data.billingStrategy ?? "manual",
      currency: data.currency,
      baseCurrency: data.baseCurrency,
      lines: data.lines as InvoiceLineInput[],
      dueAt: data.dueAt ?? null,
      branch: data.branch,
      actorId: context.userId,
    });
    await writeAudit({ actorId: context.userId, action: "invoice.issue.manual", after: result });
    return result;
  });

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    invoiceId: string;
    amountCents: number;
    gateway: "stripe" | "moyasar" | "hyperpay" | "paytabs" | "manual" | "wallet";
    gatewayRef?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageBilling");
    const sb = await admin();
    const { data: inv } = await sb.from("invoices").select("org_id, number").eq("id", data.invoiceId).maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    await assertTenantAccess(context, inv.org_id as string);
    await markInvoicePaid({ ...data, actorId: context.userId });
    await writeAudit({ actorId: context.userId, action: "invoice.pay", after: { invoiceId: data.invoiceId, amount: data.amountCents, gateway: data.gateway } });
    return { ok: true };
  });

export const cancelInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invoiceId: string; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageBilling");
    const sb = await admin();
    const { data: inv } = await sb.from("invoices").select("org_id").eq("id", data.invoiceId).maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    await assertTenantAccess(context, inv.org_id as string);
    await cancelInvoice({ invoiceId: data.invoiceId, reason: data.reason, actorId: context.userId });
    await writeAudit({ actorId: context.userId, action: "invoice.cancel", after: { invoiceId: data.invoiceId, reason: data.reason } });
    return { ok: true };
  });

export const creditNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invoiceId: string; reason: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageBilling");
    const sb = await admin();
    const { data: inv } = await sb.from("invoices").select("org_id").eq("id", data.invoiceId).maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    await assertTenantAccess(context, inv.org_id as string);
    const res = await issueCreditNote({ parentInvoiceId: data.invoiceId, reason: data.reason, actorId: context.userId });
    await writeAudit({ actorId: context.userId, action: "invoice.credit_note", after: res });
    return res;
  });

export const debitNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    invoiceId: string;
    reason: string;
    lines: Array<{ description: string; qty: number; unitPriceCents: number; kind: LineKind; taxKind?: TaxKind }>;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageBilling");
    const sb = await admin();
    const { data: inv } = await sb.from("invoices").select("org_id").eq("id", data.invoiceId).maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    await assertTenantAccess(context, inv.org_id as string);
    const res = await issueDebitNote({
      parentInvoiceId: data.invoiceId,
      extraLines: data.lines as InvoiceLineInput[],
      reason: data.reason,
      actorId: context.userId,
    });
    await writeAudit({ actorId: context.userId, action: "invoice.debit_note", after: res });
    return res;
  });

export const issueInvoiceForOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCapability(context, "canManageBilling");
    const sb = await admin();
    const { data: o } = await sb.from("license_orders").select("org_id").eq("id", data.orderId).maybeSingle();
    if (!o) throw new Error("Order not found");
    await assertTenantAccess(context, o.org_id as string);
    return issueInvoiceForOrder({ orderId: data.orderId, actorId: context.userId });
  });

export const listInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId?: string | null; status?: string | null; docType?: string | null; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    const sb = await admin();
    let q = sb.from("invoices").select("*").order("created_at", { ascending: false }).limit(Math.min(500, data.limit ?? 100));
    if (data.orgId) {
      await assertTenantAccess(context, data.orgId);
      q = q.eq("org_id", data.orgId);
    } else {
      const orgs = await visibleOrgIds(context);
      if (orgs.length === 0) return { rows: [] };
      q = q.in("org_id", orgs);
    }
    if (data.status) q = q.eq("status", data.status);
    if (data.docType) q = q.eq("doc_type", data.docType);
    const { data: rows } = await q;
    return { rows: rows ?? [] };
  });

export const getInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invoiceId: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: inv } = await sb.from("invoices").select("*").eq("id", data.invoiceId).maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    await assertTenantAccess(context, inv.org_id as string);
    const { data: lines } = await sb.from("invoice_lines").select("*").eq("invoice_id", inv.id);
    const { data: payments } = await sb.from("payments").select("*").eq("invoice_id", inv.id).order("created_at", { ascending: false });
    const { data: journals } = await sb.from("journal_entries").select("*").eq("ref_type", "invoice").eq("ref_id", inv.id).order("posted_at", { ascending: false });
    return { invoice: inv, lines: lines ?? [], payments: payments ?? [], journals: journals ?? [] };
  });

export const listBillingEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId?: string | null; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    const sb = await admin();
    let q = sb.from("billing_events").select("*").order("created_at", { ascending: false }).limit(Math.min(500, data.limit ?? 100));
    if (data.orgId) {
      await assertTenantAccess(context, data.orgId);
      q = q.eq("org_id", data.orgId);
    } else {
      const orgs = await visibleOrgIds(context);
      if (orgs.length === 0) return { rows: [] };
      q = q.in("org_id", orgs);
    }
    const { data: rows } = await q;
    return { rows: rows ?? [] };
  });

export const overdueSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCapability(context, "canManageBilling");
    const sb = await admin();
    const now = new Date().toISOString();
    const { data: rows } = await sb
      .from("invoices")
      .select("id, org_id, number")
      .in("status", ["issued", "sent", "partially_paid"])
      .lt("due_at", now);
    for (const r of rows ?? []) {
      await sb.from("invoices").update({ status: "overdue", updated_at: now }).eq("id", r.id);
      await (await import("./billing.server")).publishBillingEvent({
        orgId: (r as any).org_id,
        type: "InvoiceOverdue",
        refType: "invoice",
        refId: (r as any).id,
        actorId: context.userId,
      });
    }
    return { swept: rows?.length ?? 0 };
  });
