# Step 8E — Monitoring & Alerting

## Dashboards

| Dashboard      | Panels                                                                                         | Source                        |
| -------------- | ---------------------------------------------------------------------------------------------- | ----------------------------- |
| Application    | Req rate, latency P50/P95/P99, error rate, active sessions, 4xx/5xx by route                   | App logs → Grafana Loki       |
| Database       | CPU, memory, active conns, replication lag, slow-query top 10, table bloat                     | Supabase metrics + `pg_stat`  |
| Queues         | Job success rate, retry count, DLQ depth, oldest pending age                                   | `jobs_registry` + `dead_letter_queue` |
| Billing        | Renewal success 24h/7d, avg retry, recovery rate, MRR delta                                    | `/admin/billing/observability`|
| Webhooks       | Dispatch rate, endpoint failure rate, replay count                                             | `webhook_deliveries`          |
| Scheduler      | Next-run drift, missed ticks, lock contention                                                  | `job_runs`                    |
| Realtime       | Connected clients, presence churn                                                              | Supabase Realtime metrics     |
| Workers        | CPU/mem per worker, restarts, GC pauses                                                        | Node process metrics          |

## Alert rules

| ID    | Condition                                                    | Severity | Channel   |
| ----- | ------------------------------------------------------------ | :------: | --------- |
| A-01  | Renewal success rate 1h < 95%                                | P2       | PagerDuty |
| A-02  | Payment failure rate 1h > 5%                                 | P2       | PagerDuty |
| A-03  | Job queue depth > 500 for 10 min                             | P3       | Slack     |
| A-04  | DLQ new entries > 10 / 10 min                                | P2       | PagerDuty |
| A-05  | DB P95 latency > 250 ms sustained 5 min                      | P2       | PagerDuty |
| A-06  | 5xx error rate > 1% for 5 min                                | P1       | PagerDuty |
| A-07  | App CPU > 85% for 10 min                                     | P3       | Slack     |
| A-08  | App memory > 85% for 10 min                                  | P3       | Slack     |
| A-09  | Storage > 80% capacity                                       | P2       | Slack     |
| A-10  | Nightly backup verify failed                                 | P2       | PagerDuty |
| A-11  | Auth failure > 20/min from single IP                         | P3       | Slack     |
| A-12  | Circuit breaker open on any payment gateway > 5 min          | P2       | PagerDuty |
| A-13  | Webhook endpoint failure rate > 25% for 30 min               | P3       | Slack     |
| A-14  | `/api/v1/health/ready` non-200 for 2 consecutive checks      | P1       | PagerDuty |

## Log conventions

- All logs JSON, one line per event.
- Every log line includes `correlation_id` when in a request/job scope.
- PII (email, phone, tokens) is never logged.
- Retention: 30 days hot, 180 days cold.
