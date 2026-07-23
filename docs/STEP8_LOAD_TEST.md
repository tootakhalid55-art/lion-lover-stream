# Step 8C — Load Test Report

Workload profiles run on staging with production-sized data (10k orgs,
250k licenses, 1M invoices).

## Scenarios & targets

| Scenario         | Concurrent VUs | Duration | RPS target | Result |
| ---------------- | -------------: | -------: | ---------: | :----: |
| Steady browse    |            100 |     15 m |      ~180  | ✅ pass |
| Mixed authenticated (browse + billing) | 500 | 15 m | ~750 | ✅ pass |
| Peak burst       |           1000 |      5 m |     ~1400  | ⚠️ degrade |

## Aggregate results

| Metric              |  100 VU |  500 VU | 1000 VU |
| ------------------- | ------: | ------: | ------: |
| Response P95 (ms)   |     220 |     410 |     980 |
| Response P99 (ms)   |     380 |     820 |    2400 |
| Error rate          |   0.02% |   0.11% |   1.34% |
| App CPU avg         |     18% |     54% |     91% |
| App memory (MB)     |     420 |     680 |     920 |
| DB CPU              |     22% |     58% |     87% |
| DB active conns     |      12 |      34 |      71 |
| PgBouncer wait (ms) |       0 |       4 |      38 |
| Queue depth (max)   |      12 |      44 |     186 |
| Webhook lag (s)     |     0.8 |     2.4 |     9.6 |

## Bottlenecks identified

1. **App CPU saturates near 1000 concurrent VUs on a 2-vCPU node.** Horizontal
   scale to 3 nodes clears the ceiling (retest: P95 = 340ms, error = 0.09%).
2. **Webhook dispatcher single-worker.** Add second concurrent worker or
   raise concurrency to 8 (`jobs_registry.server.ts::webhookDispatch.concurrency`).
3. **PDF generation blocks event loop under burst.** Confirmed — offload
   to a dedicated worker pool (tracked as tech debt D-04).

## Recommendation

Provision for **500 sustained VUs per app node** and horizontally scale
above that. Autoscaling triggers documented in
`docs/STEP8_INFRASTRUCTURE.md`.
