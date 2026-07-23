# FINAL Environment Variables — Nova TV v1.0.0

All secrets are injected at container start via the platform secret store
(Lovable Cloud in managed deploys; Vault / AWS Secrets Manager self-hosted).
Never bake into images.

## Runtime
| Name             | Required | Purpose                          |
|------------------|:--------:|----------------------------------|
| `NODE_ENV`       |    ✅    | `production` / `staging` / `dev` |
| `PORT`           |    ✅    | HTTP listen port (default 3000)  |
| `LOG_LEVEL`      |          | `info` (default) / `debug`       |
| `MAINTENANCE`    |          | `1` blocks writes (503)          |

## Supabase — server
| Name                        | Required | Purpose |
|-----------------------------|:--------:|---------|
| `SUPABASE_URL`              |    ✅    | Backend URL |
| `SUPABASE_PUBLISHABLE_KEY`  |    ✅    | Publishable/anon (server client) |
| `SUPABASE_SERVICE_ROLE_KEY` |    ✅    | Admin ops, RLS-bypass client |
| `SUPABASE_DB_URL`           |    ✅    | Direct pg for migrations |

## Supabase — client build
| Name                                | Required | Purpose |
|-------------------------------------|:--------:|---------|
| `VITE_SUPABASE_URL`                 |    ✅    | Browser client URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY`     |    ✅    | Browser client key |
| `VITE_SUPABASE_PROJECT_ID`          |    ✅    | Project ref (build metadata) |

## Session / crypto
| Name             | Required | Purpose |
|------------------|:--------:|---------|
| `SESSION_SECRET` |    ✅    | Signs session cookies (rotate ≥ yearly) |

## AI Gateway
| Name              | Required | Purpose |
|-------------------|:--------:|---------|
| `LOVABLE_API_KEY` |    ✅    | Lovable AI Gateway auth |

## Xtream upstream
| Name                       | Required | Purpose |
|----------------------------|:--------:|---------|
| `XTREAM_SERVER_URL`        |    ✅    | Upstream Xtream host |
| `XTREAM_DEFAULT_USERNAME`  |    ✅    | Default account |
| `XTREAM_DEFAULT_PASSWORD`  |    ✅    | Default account password |

## Bootstrap
| Name                          | Required | Purpose |
|-------------------------------|:--------:|---------|
| `NOVA_ADMIN_BOOTSTRAP_CODE`   |    ✅    | One-shot super-admin promotion code |

## Rotation policy
- `SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `XTREAM_*`: rotate ≥ annually or on incident.
- `LOVABLE_API_KEY`: rotate via `lovable_api_key--rotate_lovable_api_key`.
- All rotations logged to `audit_logs`.
