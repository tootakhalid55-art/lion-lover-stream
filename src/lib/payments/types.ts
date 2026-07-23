// Provider-agnostic payment types. Keep this file client-safe (types only).
export type PaymentProvider = "stripe" | "moyasar" | "hyperpay" | "paytabs";
export type PaymentMode = "test" | "live";

export type ChargeStatus =
  | "requires_action"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export interface ChargeRequest {
  orgId: string;
  amountCents: number;
  currency: string;
  invoiceId?: string;
  subscriptionId?: string;
  paymentMethodRef?: string; // provider-side saved method token
  customer?: { email?: string; name?: string; phone?: string; country?: string };
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  returnUrl?: string;
}

export interface ChargeResult {
  provider: PaymentProvider;
  providerRef: string;
  status: ChargeStatus;
  amountCents: number;
  currency: string;
  clientSecret?: string;
  actionUrl?: string;
  failureCode?: string;
  failureMessage?: string;
  raw?: unknown;
}

export interface RefundRequest {
  chargeRef: string;
  amountCents?: number; // omit for full refund
  reason?: string;
  metadata?: Record<string, string>;
}

export interface RefundResult {
  provider: PaymentProvider;
  providerRef: string;
  status: "pending" | "succeeded" | "failed";
  amountCents: number;
  currency: string;
  raw?: unknown;
}

export interface WebhookEvent {
  provider: PaymentProvider;
  eventType: string; // provider-native, adapter should also map to canonical
  canonicalType?:
    | "payment.succeeded"
    | "payment.failed"
    | "payment.refunded"
    | "payment.disputed";
  providerRef?: string;
  amountCents?: number;
  currency?: string;
  metadata?: Record<string, string>;
  raw: unknown;
}
