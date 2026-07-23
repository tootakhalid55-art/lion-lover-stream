// Payment gateway abstraction. Server-only.
// Adding a new provider = implement PaymentAdapter and register it below.
import type {
  ChargeRequest,
  ChargeResult,
  PaymentMode,
  PaymentProvider,
  RefundRequest,
  RefundResult,
  WebhookEvent,
} from "./types";

export interface AdapterContext {
  orgId: string;
  mode: PaymentMode;
  /** Secret name in Lovable Cloud secrets; resolved via process.env at call time. */
  secretRef?: string;
  webhookSecretRef?: string;
  config: Record<string, unknown>;
}

export interface PaymentAdapter {
  provider: PaymentProvider;
  charge(ctx: AdapterContext, req: ChargeRequest): Promise<ChargeResult>;
  refund(ctx: AdapterContext, req: RefundRequest): Promise<RefundResult>;
  /** Parse and verify signature from a webhook body. Throws on invalid signature. */
  parseWebhook(ctx: AdapterContext, body: string, headers: Headers): Promise<WebhookEvent>;
}

class NotImplementedAdapter implements PaymentAdapter {
  constructor(public provider: PaymentProvider) {}
  private fail(): never {
    const err: Error & { code?: string } = new Error(
      `Payment adapter ${this.provider} is registered but not yet implemented`,
    );
    err.code = "adapter_not_implemented";
    throw err;
  }
  async charge() { return this.fail(); }
  async refund() { return this.fail(); }
  async parseWebhook() { return this.fail(); }
}

const registry = new Map<PaymentProvider, PaymentAdapter>([
  ["stripe", new NotImplementedAdapter("stripe")],
  ["moyasar", new NotImplementedAdapter("moyasar")],
  ["hyperpay", new NotImplementedAdapter("hyperpay")],
  ["paytabs", new NotImplementedAdapter("paytabs")],
]);

export function registerAdapter(adapter: PaymentAdapter): void {
  registry.set(adapter.provider, adapter);
}

export function getAdapter(provider: PaymentProvider): PaymentAdapter {
  const a = registry.get(provider);
  if (!a) throw new Error(`Unknown payment provider: ${provider}`);
  return a;
}

export function listRegisteredAdapters(): PaymentProvider[] {
  return Array.from(registry.keys());
}
