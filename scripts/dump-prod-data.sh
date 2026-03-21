#!/usr/bin/env bash
# 本番 Supabase からデータのみダンプする（--linked に依存しない）。
# 接続先は scripts/sync-db-targets.json の production。.env.local の
# SUPABASE_PROD_PROJECT_REF / SUPABASE_PROD_POOLER_HOST で上書き可。
#
# 使い方: dump-prod-data.sh <出力.sql>
# ダンプには本番 DB パスワード（SUPABASE_PROD_DB_PASSWORD）が必要。

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "${1:-}" = "" ]; then
  echo "usage: $0 <output.sql>" >&2
  exit 1
fi
OUTPUT_FILE="$1"

TARGET_JSON="${ROOT}/scripts/sync-db-targets.json"
if [ ! -f "$TARGET_JSON" ]; then
  echo "Missing ${TARGET_JSON}" >&2
  exit 1
fi

read -r DEFAULT_REF DEFAULT_HOST < <(
  python3 -c "
import json
with open(r'''${TARGET_JSON}''') as f:
    t = json.load(f)['production']
print(t['projectRef'], t['poolerHost'])
"
)

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

PROD_REF="${SUPABASE_PROD_PROJECT_REF:-$DEFAULT_REF}"
POOLER_HOST="${SUPABASE_PROD_POOLER_HOST:-$DEFAULT_HOST}"

if [ -z "${SUPABASE_PROD_DB_PASSWORD:-}" ]; then
  echo "SUPABASE_PROD_DB_PASSWORD is not set (e.g. in .env.local)." >&2
  exit 1
fi

ENC_USER="$(python3 -c "import urllib.parse; print(urllib.parse.quote('postgres.${PROD_REF}', safe=''))")"
ENC_PW="$(python3 -c "import urllib.parse, os; print(urllib.parse.quote(os.environ['SUPABASE_PROD_DB_PASSWORD'], safe=''))")"
DB_URL="postgresql://${ENC_USER}:${ENC_PW}@${POOLER_HOST}:5432/postgres?sslmode=require"

pnpm exec supabase db dump --data-only \
  --db-url "$DB_URL" \
  -x storage.buckets \
  -x storage.objects \
  -x storage.s3_multipart_uploads \
  -x storage.s3_multipart_uploads_parts \
  -f "$OUTPUT_FILE"

echo "Dumped production data to ${OUTPUT_FILE} (project ${PROD_REF})."
