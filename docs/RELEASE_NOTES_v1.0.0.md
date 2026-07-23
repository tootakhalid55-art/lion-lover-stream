# Nova TV — Release Notes v1.0.0

**Release date:** 2026-07-23
**Git tag:** `v1.0.0`
**Status:** ✅ GO for production

## Highlights

Nova TV v1.0.0 is the first production-certified release of the platform.
It ships a complete streaming + billing + licensing stack:

- Premium RTL streaming UI (Nova TV brand, dark cinematic theme).
- Multi-engine video player with universal codec support.
- Multi-tenant SaaS backend: organizations, resellers, wallet, orders, invoices, subscriptions, dunning.
- REST API v1 with API keys, scopes, HMAC-signed webhooks, OpenAPI 3.1.
- Admin cockpit: Trace Center, Observability dashboard, jobs, audit, security.
- Full production hardening: CI/CD, monitoring, DR (RPO ≤ 5m, RTO ≤ 60m), load-tested to 500 sustained VUs.

## Upgrade notes

First release — no upgrade path required.

## Known limitations

See `docs/FINAL_PRODUCTION_CERTIFICATION.md` §9.

## Post-launch watch

- 72-hour SRE watch after cutover.
- Auth-failure alert threshold tuning per tenant (S-02).
- Backlog: D-01..D-06 scheduled post-launch.

## Credits

Built on TanStack Start, Supabase (Lovable Cloud), and the Lovable AI Gateway.
