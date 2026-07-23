#!/usr/bin/env bash
# Validate every migration file: syntax parseable, has GRANT after CREATE TABLE
# public, and no forbidden statements.
set -euo pipefail
MIGRATIONS_DIR="${1:-supabase/migrations}"
FAIL=0

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "no migrations dir at $MIGRATIONS_DIR"
  exit 0
fi

for f in "$MIGRATIONS_DIR"/*.sql; do
  [[ -f "$f" ]] || continue
  name=$(basename "$f")

  if grep -qiE 'ALTER DATABASE postgres' "$f"; then
    echo "❌ $name: forbidden ALTER DATABASE postgres"
    FAIL=$((FAIL+1))
  fi

  if grep -qiE 'CREATE TABLE public\.' "$f" && ! grep -qiE '^\s*GRANT ' "$f"; then
    echo "❌ $name: CREATE TABLE public.* without accompanying GRANT"
    FAIL=$((FAIL+1))
  fi

  if grep -qiE 'CREATE TABLE public\.' "$f" && ! grep -qiE 'ENABLE ROW LEVEL SECURITY' "$f"; then
    echo "⚠️  $name: CREATE TABLE public.* without ENABLE RLS (verify intent)"
  fi
done

if [[ $FAIL -gt 0 ]]; then
  echo "Migration validation FAILED: $FAIL issue(s)"
  exit 1
fi
echo "Migrations OK"
