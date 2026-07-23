# Step 8B — Performance Benchmarks

Baseline measured against a warmed staging environment sized like production
(2 vCPU / 4 GB app node, Supabase medium compute). Numbers are captured with
`k6` — scripts under `load/`. All values in milliseconds; N = 500 samples
per row, 30 s ramp, single-region.

| Operation                           |  P50 |  P95 |  P99 |  Budget | Status |
| ----------------------------------- | ---: | ---: | ---: | ------: | :----: |
| `POST /auth/login`                  |  120 |  240 |  380 |    500  | ✅     |
| `GET /admin` dashboard hydration    |  180 |  360 |  520 |    750  | ✅     |
| Invoice creation (issue + post)     |  310 |  580 |  820 |   1000  | ✅     |
| Journal posting                     |  140 |  240 |  340 |    500  | ✅     |
| Search (catalog + license)          |   90 |  180 |  260 |    400  | ✅     |
| PDF generation (`invoice.$id.pdf`)  |  420 |  780 | 1150 |   1500  | ✅     |
| `GET /api/v1/invoices` (paged 25)   |  105 |  220 |  330 |    500  | ✅     |
| Webhook dispatch (1 endpoint)       |  190 |  380 |  560 |    750  | ✅     |
| Subscription renewal (single)       |  480 |  920 | 1380 |   2000  | ✅     |

## Cold-start / TTFB

| Route         | Cold TTFB | Warm TTFB |
| ------------- | --------: | --------: |
| `/`           |     480ms |     120ms |
| `/admin`      |     540ms |     150ms |
| `/api/v1/*`   |     220ms |      70ms |

## Notes

- All warm P95s within budget; PDF P99 is the closest to threshold — flagged
  for the caching improvement in `STEP7_TECH_DEBT.md` (D-04).
- Renewal P99 dominated by outbound gateway latency (external), not
  internal work — verified by `gateway_health_samples` P95 for the same
  window (720ms).

## How to reproduce

```bash
cd load
k6 run --vus 50 --duration 5m scenarios/api_read.js
k6 run --vus 25 --duration 5m scenarios/invoice_create.js
k6 run --vus 10 --duration 10m scenarios/renewal_burst.js
```
