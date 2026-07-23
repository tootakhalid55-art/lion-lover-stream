// Payment gateway abstraction. Server-only.
// Adding a new provider = implement PaymentAdapter and register it below.
// Instrumentation (health/latency/retry) is layered by `instrumentAdapter`
// so individual adapters stay free of cross-cutting concerns.
import type {
  ChargeRequest,
  ChargeResult,
  PaymentMode,
  PaymentProvider,
  RefundRequest,
  RefundResult,
  WebhookEvent,
} from "./types";
import { recordGatewaySample, isCircuitOpen } from "../gateway-health.server";

export interface AdapterContext {
  orgId: string;
  mode: PaymentMode;
  /** Secret name in Lovable Cloud secrets; resolved via process.env at call time. */
  secretRef?: string;
  webhookSecretRef?: string;
  config: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Optional capability flags an adapter may declare. Extending this map
 * is how we support gateway-specific features (Apple Pay, 3DS, saved
 * mandates, marketplace splits, etc.) WITHOUT changing the core
 * PaymentAdapter contract. Callers that need a capability check
 * `adapter.capabilities?.[name]` before invoking optional methods.
 */
export interface AdapterCapabilities {
  savedCards?: boolean;
  refunds?: boolean;
  partialRefunds?: boolean;
  disputes?: boolean;
  threeDSecure?: boolean;
  applePay?: boolean;
  googlePay?: boolean;
  mada?: boolean;
  stcPay?: boolean;
  installments?: boolean;
  subscriptions?: boolean;
  marketplaceSplits?: boolean;
  [ext: string]: boolean | undefined;
}

export interface PaymentAdapter {
  provider: PaymentProvider;
  capabilities?: AdapterCapabilities;
  charge(ctx: AdapterContext, req: ChargeRequest): Promise<ChargeResult>;
  refund(ctx: AdapterContext, req: RefundRequest): Promise<RefundResult>;
  /** Parse and verify signature from a webhook body. Throws on invalid signature. */
  parseWebhook(ctx: AdapterContext, body: string, headers: Headers): Promise<WebhookEvent>;
  /** Optional gateway-specific extensions. Callers must feature-detect via `capabilities`. */
  extras?: Record<string, (ctx: AdapterContext, ...args: unknown[]) => Promise<unknown>>;
}

class NotImplementedAdapter implements PaymentAdapter {
  constructor(public provider: PaymentProvider) {}
  capabilities: AdapterCapabilities = {};
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

/**
 * Wrap an adapter with health/latency instrumentation and circuit-breaker
 * short-circuit. Every registered adapter is passed through this so
 * dashboards get accurate metrics regardless of implementer discipline.
 */
export function instrumentAdapter(a: PaymentAdapter): PaymentAdapter {
  const wrap = async <T>(op: string, ctx: AdapterContext, fn: () => Promise<T>): Promise<T> => {
    if (await isCircuitOpen(a.provider, ctx.mode)) {
      const err: Error & { code?: string; kind?: string } = new Error(`Circuit open for ${a.provider}`);
      err.code = "circuit_open";
      err.kind = "circuit_open";
      throw err;
    }
    const started = Date.now();
    try {
      const result = await fn();
      await recordGatewaySample({
        provider: a.provider, mode: ctx.mode, op,
        latencyMs: Date.now() - started, success: true,
        correlationId: ctx.correlationId,
      });
      return result;
    } catch (e: unknown) {
      const err = e as { code?: string; status?: number; message?: string };
      await recordGatewaySample({
        provider: a.provider, mode: ctx.mode, op,
        latencyMs: Date.now() - started, success: false,
        errorCode: err.code || (err.status ? `http_${err.status}` : "error"),
        correlationId: ctx.correlationId,
      });
      throw e;
    }
  };
  return {
    provider: a.provider,
    capabilities: a.capabilities,
    extras: a.extras,
    charge: (ctx, req) => wrap("charge", ctx, () => a.charge(ctx, req)),
    refund: (ctx, req) => wrap("refund", ctx, () => a.refund(ctx, req)),
    parseWebhook: (ctx, body, headers) => wrap("parseWebhook", ctx, () => a.parseWebhook(ctx, body, headers)),
  };
}

const registry = new Map<PaymentProvider, PaymentAdapter>([
  ["stripe", instrumentAdapter(new NotImplementedAdapter("stripe"))],
  ["moyasar", instrumentAdapter(new NotImplementedAdapter("moyasar"))],
  ["hyperpay", instrumentAdapter(new NotImplementedAdapter("hyperpay"))],
  ["paytabs", instrumentAdapter(new NotImplementedAdapter("paytabs"))],
]);

export function registerAdapter(adapter: PaymentAdapter): void {
  registry.set(adapter.provider, instrumentAdapter(adapter));
}

export function getAdapter(provider: PaymentProvider): PaymentAdapter {
  const a = registry.get(provider);
  if (!a) throw new Error(`Unknown payment provider: ${provider}`);
  return a;
}

export function listRegisteredAdapters(): PaymentProvider[] {
  return Array.from(registry.keys());
}
