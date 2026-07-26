# Step 8F — CI/CD Pipeline

## Stages (GitHub Actions — see `.github/workflows/ci.yml`)

1. **install** — `bun install --frozen-lockfile`
2. **lint** — `bun run lint`
3. **typecheck** — `bunx tsgo --noEmit`
4. **unit tests** — `bunx vitest run`
5. **integration tests** — `bunx vitest run --project integration`
6. **security scan** — `bun audit --production` + Semgrep OWASP ruleset
7. **migration validation** — `scripts/migrations-check.sh` (dry-run + linter)
8. **build** — `bun run build`
9. **artifact** — upload `.output/` as build artifact tagged with commit SHA
10. **deploy staging** (auto on `main`)
11. **smoke tests** — `scripts/smoke.sh` against staging
12. **deploy production** (auto on `main` after staging smoke passes)
13. **smoke tests** — `scripts/smoke.sh` against production

## Branch policy

- `main` — deploys to Staging automatically, then to Production automatically after smoke tests pass.
- Tags `v*` still trigger the same workflow for traceability, but are no longer required for production deploys.
- Direct pushes to `main` should be disabled; PRs require 1 review + green CI.

## Environment promotion

```
dev  ──►  staging  ──►  production
       (auto)         (auto after staging smoke)
```

Each environment has its own Supabase project, secrets, and domain. No
manual promotion; all changes go through the pipeline.

> **Warning:** Because production deploys automatically, any merge to `main` reaches users within minutes. Keep `main` protected and require pull-request reviews.
