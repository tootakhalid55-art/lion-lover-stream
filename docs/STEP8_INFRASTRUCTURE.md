# Step 8G — Infrastructure

The stack is fully reproducible from source; no manual configuration is
required beyond secret injection.

## Artifacts

| Artifact                  | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `Dockerfile`              | Multi-stage build → runtime image             |
| `docker-compose.yml`      | Single-host production-like stack             |
| `infra/nginx.conf`        | TLS termination + reverse proxy + headers     |
| `.env.example`            | Environment template                          |
| `.github/workflows/ci.yml`| CI/CD pipeline                                |
| `scripts/deploy.sh`       | Deploy helper (rsync + systemd restart)       |
| `scripts/smoke.sh`        | Post-deploy verification                      |
| `scripts/migrations-check.sh` | Guard rails for schema changes            |
| `scripts/backup-verify.sh`| Nightly restore-into-scratch validation       |

## Reference deployment (VPS)

```
┌────────────┐    443     ┌──────────────┐   3000    ┌──────────────┐
│  Internet  │ ─────────► │   nginx      │ ────────► │  node .output│
└────────────┘            │  (TLS,       │           │  (2 vCPU)    │
                          │   headers)   │           └──────┬───────┘
                          └──────────────┘                  │
                                                    Supabase (PG + Auth + Realtime)
```

## Sizing

| Tier         | App           | DB compute       | Notes                       |
| ------------ | ------------- | ---------------- | --------------------------- |
| Staging      | 1× 1 vCPU/2 GB| Small            | Auto-shutdown after 22:00   |
| Production   | 2× 2 vCPU/4 GB| Medium           | Auto-scale to 3 at CPU > 70%|
| Peak burst   | 3× 2 vCPU/4 GB| Large            | Manual on major campaigns   |

## TLS

Let's Encrypt via `certbot` — renewal cron every 12h. Cert files mount
into nginx at `/etc/nginx/certs`.

## Secrets

Runtime secrets live in the platform secret store (Lovable Cloud for
managed deploys, HashiCorp Vault / AWS Secrets Manager for self-hosted).
They are injected as env vars at container start; never baked into images.

## Terraform (self-hosted)

A minimal Terraform module lives at `infra/terraform/` (Hetzner + Cloudflare
DNS + Let's Encrypt). See its README for provider setup.
