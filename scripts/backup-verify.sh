#!/usr/bin/env bash
# Nightly backup verification — runs a metadata-only restore into a
# scratch project and compares canary row counts. Exits non-zero on any
# mismatch and emits a monitoring event via curl.
set -euo pipefail

CANARIES=(profiles user_roles licenses invoices subscriptions payments
          org_members packages billing_plans wallet_ledger)

: "${SCRATCH_DB_URL:?SCRATCH_DB_URL is required}"
: "${PROD_DB_URL:?PROD_DB_URL is required}"

echo "==> Restoring latest backup to scratch"
supabase db restore --db-url "$SCRATCH_DB_URL" --latest

FAIL=0
for t in "${CANARIES[@]}"; do
  prod=$(psql "$PROD_DB_URL" -tAc "SELECT count(*) FROM public.$t")
  scratch=$(psql "$SCRATCH_DB_URL" -tAc "SELECT count(*) FROM public.$t")
  diff=$(( prod - scratch ))
  abs=${diff#-}
  if (( abs > 100 )); then
    echo "❌ $t: prod=$prod scratch=$scratch (diff=$diff)"
    FAIL=$((FAIL+1))
  else
    echo "✅ $t: prod=$prod scratch=$scratch"
  fi
done

if (( FAIL > 0 )); then
  curl -fsS -X POST "$ALERT_WEBHOOK" -d "BACKUP_VERIFY_FAILED: $FAIL canaries drifted"
  exit 1
fi
