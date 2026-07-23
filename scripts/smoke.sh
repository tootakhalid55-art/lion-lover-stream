#!/usr/bin/env bash
# Post-deploy smoke test. Exits non-zero on any failure.
set -euo pipefail
BASE="${1:-http://localhost:3000}"
FAIL=0

check() {
  local name="$1" url="$2" expect="${3:-200}"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$url" || echo "000")
  if [[ "$code" == "$expect" ]]; then
    printf "  ✅ %-32s %s\n" "$name" "$code"
  else
    printf "  ❌ %-32s expected=%s got=%s\n" "$name" "$expect" "$code"
    FAIL=$((FAIL+1))
  fi
}

echo "Smoke: $BASE"
check "liveness"      "$BASE/api/v1/health/live"
check "readiness"     "$BASE/api/v1/health/ready"
check "version"       "$BASE/api/v1/health/version"
check "home"          "$BASE/"
check "login page"    "$BASE/login"
check "openapi"       "$BASE/api/v1/openapi"
check "api docs"      "$BASE/api/v1/docs"
check "auth required" "$BASE/admin"                       200
check "webhooks auth" "$BASE/api/v1/webhooks/endpoints"   401
check "404 handled"   "$BASE/this-route-does-not-exist"   404

if [[ $FAIL -gt 0 ]]; then
  echo "Smoke FAILED: $FAIL check(s)"
  exit 1
fi
echo "Smoke OK"
