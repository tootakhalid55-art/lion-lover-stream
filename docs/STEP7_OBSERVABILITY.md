# Billing Observability Guide

Live KPIs are exposed at `/admin/billing/observability`, refreshing every 30s
and computed by `getObservabilitySnapshot({ window })` where `window` is one of
`24h`, `7d`, or `30d`.

## KPIs

| KPI                        | Definition                                                            | Data source                                    |
| -------------------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| Renewal Success Rate       | `renewed / (renewed + payment_failed)` from `subscription_events`     | `subscription_events`                          |
| Renewal Failure Rate       | `100 - success_rate`                                                  | derived                                        |
| Payment Success Rate       | `success charges / total charges`                                     | `gateway_health_samples(op=charge)`            |
| Payment Failure Rate       | `100 - payment_success`                                               | derived                                        |
| Retry Count                | Σ (webhook `attempt - 1`)                                             | `webhook_deliveries`                           |
| Retry Success %            | delivered / (delivered + failed) among retried                        | `webhook_deliveries`                           |
| Dunning Conversion Rate    | `past_due subs that later renewed / past_due subs`                    | `subscription_events`                          |
| Gateway Latency P50/P95/P99| quantiles over charge samples                                         | `gateway_health_samples.latency_ms`            |
| Circuit Breaker State      | per provider/mode, open when failures ≥ policy threshold in window    | `gateway_retry_policies` + samples             |
| Outbox Pending / Dead      | rows with status `pending`/`in_flight` and `dead`                     | `outbox_events`                                |
| DLQ Size                   | total rows                                                            | `dead_letter_queue`                            |
| Webhook Delivery Success   | `delivered / (delivered + failed + dead)`                             | `webhook_deliveries`                           |
| Avg Renewal Duration       | mean of gateway charge latency in window                              | `gateway_health_samples`                       |

The activity chart plots `renewed`, `failed`, and `payments` bucketed by hour
(24h view) or by day (7d / 30d views).

## Alerting thresholds (recommended)

Wire your alerting service (e.g. PagerDuty via a webhook endpoint) against
these thresholds:

- **P1** — renewal success rate < 90% for 15 min, any circuit breaker open,
  DLQ > 0, webhook success rate < 95% for 15 min.
- **P2** — payment P95 latency > 5s for 30 min, outbox `dead` > 0, dunning
  conversion drop > 20 pts week-over-week.
- **P3** — retry count spike > 3σ vs baseline, avg renewal duration > 4s.

## Data hygiene

All source tables include `correlation_id`. When drilling into a spike, click
the failing rows through to Trace Center to see the full timeline.

`gateway_health_samples` is append-only and unbounded — a periodic prune job
(`billing.retention`) will keep the last 90 days in a follow-up (tracked in
`STEP7_TECH_DEBT.md`).
