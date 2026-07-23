# Changelog

All notable changes to Nova TV are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-07-23

### Added
- **Streaming**: Xtream Codes integration with health checks, retry, caching, rate limiting, and audit logging.
- **Player**: Multi-engine (`hls.js`, `mpegts.js`, Native HLS) with fallback chain and synthetic VOD manifest generator.
- **Auth**: Supabase-backed authentication, session middleware, role-based access, device & session managers.
- **Multi-tenancy**: Organization tree, reseller hierarchy, org-scoped RLS.
- **Licensing**: Packages, pricing rules, activation codes, license lifecycle.
- **Wallet & Orders**: Immutable ledger, reservations, order workflow.
- **Billing**: ZATCA Phase-1 invoicing, double-entry journal, PDF generation, tax engine.
- **Subscriptions**: State-machine driven renewal, dunning engine, grace/expiry handling.
- **Payments**: Provider-agnostic adapter, HMAC webhook ingress, refund workflow.
- **REST API v1**: 16 endpoints, hashed API keys, granular scopes, OpenAPI 3.1, HMAC-signed outbound webhooks.
- **Observability**: Workflow Trace Center, Billing Observability dashboard, correlation IDs across every workflow.
- **Reliability**: Idempotency ledger, Postgres advisory locks, circuit breakers, DLQ.
- **Ops**: CI/CD (GitHub Actions), Dockerfile, docker-compose, nginx TLS, Terraform scaffold, verified backup script.
- **Docs**: STEP6–STEP8 audit/perf/load/DR/monitoring/CI/CD/infra/ops/release-readiness.

### Security
- RLS enabled on all 68 tables with role- and org-scoped policies.
- Secrets managed via Lovable Cloud secret store; none in source.
- HMAC signature verification on inbound webhooks; timing-safe comparisons.

### Deferred
- ERP modules: CRM, Sales, Purchases, Inventory, Banking, Fixed Assets, Approvals, Reporting.
- Distributed circuit breaker (D-02).
- Enforced admin MFA (D-03).
