#!/usr/bin/env bash
# 本番からデータダンプ → Staging（sync-db-targets.json の staging）へ取り込む。
# ダンプファイルは mktemp + chmod 600、終了時に削除。

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TRUNCATE_SQL="${ROOT}/scripts/db-sync-truncate-app-data.sql"
if [ ! -f "$TRUNCATE_SQL" ]; then
  echo "Missing ${TRUNCATE_SQL}. Restore it from the repository." >&2
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "db:sync-staging requires .env.local with SUPABASE_PROD_DB_PASSWORD and SUPABASE_STAGING_DB_PASSWORD." >&2
  echo "Copy from .env.example and fill in values." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env.local
set +a

if [ -z "${SUPABASE_PROD_DB_PASSWORD:-}" ] || [ -z "${SUPABASE_STAGING_DB_PASSWORD:-}" ]; then
  echo "SUPABASE_PROD_DB_PASSWORD and SUPABASE_STAGING_DB_PASSWORD must be set in .env.local." >&2
  exit 1
fi

TARGET_JSON="${ROOT}/scripts/sync-db-targets.json"
if [ ! -f "$TARGET_JSON" ]; then
  echo "Missing ${TARGET_JSON}. Restore it from the repository." >&2
  exit 1
fi

read -r DEFAULT_STAGING_REF DEFAULT_STAGING_HOST < <(
  python3 -c "
import json
with open(r'''${TARGET_JSON}''') as f:
    t = json.load(f)['staging']
print(t['projectRef'], t['poolerHost'])
"
)

STAGING_REF="${SUPABASE_STAGING_PROJECT_REF:-$DEFAULT_STAGING_REF}"
STAGING_HOST="${SUPABASE_STAGING_POOLER_HOST:-$DEFAULT_STAGING_HOST}"

DUMP="$(mktemp "${TMPDIR:-/tmp}/tabigoyomi-prod-dump.XXXXXX.sql")"
chmod 600 "$DUMP"
cleanup() {
  rm -f "$DUMP"
}
trap cleanup EXIT INT TERM

"${ROOT}/scripts/dump-prod-data.sh" "$DUMP"

env PGPASSWORD="$SUPABASE_STAGING_DB_PASSWORD" PGSSLMODE=require \
  psql -h "$STAGING_HOST" -p 5432 -U "postgres.${STAGING_REF}" -d postgres \
  -f "$TRUNCATE_SQL"

env PGPASSWORD="$SUPABASE_STAGING_DB_PASSWORD" PGSSLMODE=require \
  psql -h "$STAGING_HOST" -p 5432 -U "postgres.${STAGING_REF}" -d postgres -q -f "$DUMP"

echo 'Staging sync complete'
