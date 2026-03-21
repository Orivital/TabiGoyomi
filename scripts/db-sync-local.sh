#!/usr/bin/env bash
# 本番からデータダンプ → ローカル Supabase をリセットして取り込む。
# ダンプファイルは mktemp + chmod 600、終了時に削除（本番データの取り残しを防ぐ）。

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TRUNCATE_SQL="${ROOT}/scripts/db-sync-truncate-app-data.sql"
if [ ! -f "$TRUNCATE_SQL" ]; then
  echo "Missing ${TRUNCATE_SQL}. Restore it from the repository." >&2
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "db:sync requires .env.local with SUPABASE_PROD_DB_PASSWORD (and other local dev vars)." >&2
  echo "Copy from .env.example and fill in values." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env.local
set +a

missing_vars=()
if [ -z "${SUPABASE_PROD_DB_PASSWORD:-}" ]; then
  missing_vars+=(SUPABASE_PROD_DB_PASSWORD)
fi
if [ "${#missing_vars[@]}" -ne 0 ]; then
  echo "After sourcing .env.local, required variable(s) are unset or empty: ${missing_vars[*]}" >&2
  echo "Set non-empty values for the listed names in .env.local. (A missing file is reported before sourcing; a .env.local syntax error exits during sourcing before this check.)" >&2
  exit 1
fi

DUMP="$(mktemp "${TMPDIR:-/tmp}/tabigoyomi-prod-dump.XXXXXX.sql")"
chmod 600 "$DUMP"
cleanup() {
  rm -f "$DUMP"
}
trap cleanup EXIT INT TERM

"${ROOT}/scripts/dump-prod-data.sh" "$DUMP"

pnpm exec supabase db reset --local

psql -v ON_ERROR_STOP=1 -q postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f "$TRUNCATE_SQL"

psql -v ON_ERROR_STOP=1 -q postgresql://postgres:postgres@127.0.0.1:54322/postgres -f "$DUMP"

echo 'DB sync complete'
