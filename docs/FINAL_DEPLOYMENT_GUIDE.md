# FINAL Deployment Guide — Nova TV v1.0.0

Three environments, continuous promotion from `main`.

```
dev  ──►  staging  ──►  production
       (auto on main)   (auto on main after staging smoke)
```

> ⚠️ **Auto-deploy is enabled for Production.** Every merge/push to `main` that passes build, tests, migration validation, and staging smoke tests will be deployed automatically to `https://tv.canarmodern.com`. Make sure branch protection and peer review are active on `main` to avoid shipping broken code directly to users.

## Environments

| Env         | Domain                     | Deploy trigger                                  | Supabase project |
|-------------|----------------------------|-------------------------------------------------|------------------|
| Development | preview URLs               | Every commit                                    | dev              |
| Staging     | `https://staging.nova-tv.app` | Auto on `main`                               | staging          |
| Production  | `https://tv.canarmodern.com` | Auto on `main` after staging smoke passes    | production       |

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
11. Auto-deploy production (from `main`) **only after staging smoke passes**
12. `scripts/smoke.sh https://tv.canarmodern.com`

## Deploy targets

**Managed (Lovable Cloud):** click Publish; frontend requires Update; backend auto.

**Self-hosted VPS:** `docker compose up -d` behind nginx (see `docs/STEP8_INFRASTRUCTURE.md`).
- 2× 2 vCPU / 4 GB app nodes (autoscale to 3 at CPU > 70%).
- Let's Encrypt via certbot; renew every 12h.
- Secrets injected as env vars at container start.

## Release procedure

1. Open a PR to `main`; ensure CI is green and at least one reviewer approves.
2. Merge to `main` → staging auto-deploys.
3. Staging smoke tests must pass (12/12 green).
4. Production deploys automatically from the same artifact.
5. Production smoke tests must pass.
6. Watch monitoring dashboards for 72h after major releases.
7. Rollback: `git revert` the offending commit, merge the revert to `main`, or run `scripts/deploy.sh production <previous-artifact>`.

## GitHub environment protection

To allow fully automatic production deploys, disable the manual approval gate in the repository settings:

1. GitHub repo → Settings → Environments → `production`.
2. Remove required reviewers / wait timer, or delete the `production` environment.
3. Keep `staging` environment protection if you want an optional pause before production.

If you ever need to pause auto-deploy, push an empty commit with `[skip ci]` in the message or temporarily disable the workflow in GitHub Actions.

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
