# FINAL Deployment Guide — Nova TV v1.0.0

Three environments, strict promotion, no direct-to-production changes.

```
dev  ──►  staging  ──►  production
       (auto on main)   (tag v* + approval + smoke)
```

## Environments

| Env         | Domain                     | Deploy trigger              | Supabase project |
|-------------|----------------------------|-----------------------------|------------------|
| Development | preview URLs               | Every commit                | dev              |
| Staging     | `https://staging.nova-tv.app` | Auto on `main`           | staging          |
| Production  | `https://tv.canarmodern.com` | Git tag `v*` + approval | production       |

## CI/CD pipeline

Defined in `.github/workflows/ci.yml`:

1. `bun install --frozen-lockfile`
2. `bun run lint`
3. `bunx tsgo --noEmit`
4. `bunx vitest run` (unit + integration)
5. `bun audit --production` + Semgrep OWASP
6. `scripts/migrations-check.sh`
7. `bun run build` → `.output/`
8. Upload build artifact (14-day retention)
9. Auto-deploy staging (from `main`)
10. `scripts/smoke.sh https://staging.nova-tv.app`
11. Tag `v*` triggers production job; manual approver required
12. `scripts/deploy.sh production` + smoke

## Deploy targets

**Managed (Lovable Cloud):** click Publish; frontend requires Update; backend auto.

**Self-hosted VPS:** `docker compose up -d` behind nginx (see `docs/STEP8_INFRASTRUCTURE.md`).
- 2× 2 vCPU / 4 GB app nodes (autoscale to 3 at CPU > 70%).
- Let's Encrypt via certbot; renew every 12h.
- Secrets injected as env vars at container start.

## Release procedure

1. Merge to `main` → staging auto-deploys.
2. Verify staging smoke (12/12 green).
3. Tag: `git tag v1.0.0 && git push --tags`.
4. Approve production job in GitHub Actions.
5. Watch monitoring dashboards for 72h.
6. Rollback: `git revert` + tag `v1.0.<n+1>` OR `scripts/deploy.sh production <previous-artifact>`.

## Migrations

- Never edit merged migration files.
- CI validates via dry-run + linter.
- Production migrations execute as part of the deploy job (advisory-locked).

## Post-deploy checklist

- [ ] Smoke tests pass on target env.
- [ ] `/api/v1/health/ready` returns 200.
- [ ] `admin.system` dashboard shows all breakers closed.
- [ ] Error rate < 0.2% for first 30 min.
- [ ] SRE bridge stays open 72h for major releases.
