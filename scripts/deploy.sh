#!/usr/bin/env bash
# Deploy helper — invoked by CI after build artifact is downloaded.
# Actual deploy target is environment-specific; this is the contract.
set -euo pipefail
TARGET="${1:?usage: deploy.sh <staging|production>}"

case "$TARGET" in
  staging)
    HOST="${STAGING_HOST:?STAGING_HOST is required}"
    ;;
  production)
    HOST="${PROD_HOST:?PROD_HOST is required}"
    ;;
  *)
    echo "Unknown target: $TARGET" >&2
    exit 2
    ;;
esac

echo "==> Deploying to $TARGET ($HOST)"
rsync -az --delete .output/ "$HOST:/srv/nova-tv/.output/"
ssh "$HOST" 'sudo systemctl restart nova-tv.service'
echo "==> Deploy done"
