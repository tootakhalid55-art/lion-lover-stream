# Migration History

All schema changes are captured as immutable SQL migration files under
`supabase/migrations/`. This file is a human index; the SQL is the source of truth.

| # | Timestamp        | Migration                                         | Domain |
|--:|------------------|---------------------------------------------------|--------|
| 1 | 2026-07-23 17:29 | `20260723172916_..._a1998c05.sql`                 | Auth, profiles, user_roles bootstrap |
| 2 | 2026-07-23 17:29 | `20260723172930_..._5719d42a.sql`                 | Devices, sessions, audit_logs |
| 3 | 2026-07-23 17:40 | `20260723174023_..._e4e3b637.sql`                 | Packages, licenses, activation codes |
| 4 | 2026-07-23 17:41 | `20260723174152_..._f72932c0.sql`                 | Resellers, organizations, org_members |
| 5 | 2026-07-23 18:09 | `20260723180942_..._11c5a9f2.sql`                 | Wallet ledger, reservations, orders |
| 6 | 2026-07-23 18:44 | `20260723184444_..._6f02ed1d.sql`                 | Billing: invoices, journal, tax rules |
| 7 | 2026-07-23 18:59 | `20260723185901_..._2b0a0bd6.sql`                 | REST API v1: api_keys, webhooks, idempotency |
| 8 | 2026-07-23 19:07 | `20260723190753_..._fa61d456.sql`                 | Validation fixes + health tables |
| 9 | 2026-07-23 19:21 | `20260723192117_..._f5c4fe12.sql`                 | Subscriptions + payments schema |
|10 | 2026-07-23 21:21 | `20260723212134_..._7fb3ed88.sql`                 | Idempotency, correlation, advisory locks |
|11 | 2026-07-23 21:30 | `20260723213036_..._04d3d930.sql`                 | Dunning policies, jobs, gateway health |
|12 | 2026-07-23 21:30 | `20260723213052_..._3b924b6f.sql`                 | Workflow trace + observability views |

## Policy

- Migrations are append-only. Never edit a merged migration file.
- Every `CREATE TABLE` in `public` includes GRANTs and RLS in the same file.
- All migrations validated by `scripts/migrations-check.sh` in CI.
- Production migrations run only via the CI/CD promotion pipeline.
