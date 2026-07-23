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
12. **production approval** — required reviewer + tag `v*` push
13. **deploy production** — manual approval gate

## Branch policy

- `main` — deploys to Staging automatically.
- Production deploys only from tags matching `v[0-9]+.[0-9]+.[0-9]+`.
- Direct pushes to `main` disabled; PRs require 1 review + green CI.

## Environment promotion

```
dev  ──►  staging  ──►  production
       (auto)         (tag + approval)
```

Each environment has its own Supabase project, secrets, and domain. No
manual promotion; all changes go through the pipeline.
