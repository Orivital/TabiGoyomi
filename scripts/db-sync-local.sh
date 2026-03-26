#!/usr/bin/env bash
# 本番からデータダンプ → ローカルへ取り込む。
# - スキーマ: supabase db reset は使わず、未適用マイグレーションだけ migration up（データは消さない）
# - データ: アプリ用テーブルを TRUNCATE したうえでダンプを流し込む（本番相当に揃える）
# ダンプファイルは mktemp + chmod 600、終了時に削除（本番データの取り残しを防ぐ）。
# DB が壊れた・履歴がずれたときだけ、手動で supabase db reset を検討する。
#
# 想定実行: devbox run db:sync（devbox の postgresql で psql が使える）
# devbox 外ではホストに psql が無いことがあるため、supabase_db_* コンテナ経由にフォールバックする。

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

pnpm exec supabase migration up --local

# psql が PATH に無い環境では、supabase start の DB コンテナ経由で実行する
# （supabase db query -f は複文 SQL を受け付けないためダンプに使えない）
run_psql_file_local() {
  local sqlfile="$1"
  if command -v psql >/dev/null 2>&1; then
    psql -v ON_ERROR_STOP=1 -q postgresql://postgres:postgres@127.0.0.1:54322/postgres \
      -f "$sqlfile"
    return
  fi
  local c
  c="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -E '^supabase_db_' | head -n1 || true)"
  if [[ -n "$c" ]]; then
    docker exec -i "$c" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f - <"$sqlfile"
    return
  fi
  echo "db-sync-local: psql が見つかりません。postgresql クライアントを入れるか、Docker で supabase start 済みであることを確認してください。" >&2
  exit 1
}

run_psql_file_local "$TRUNCATE_SQL"
run_psql_file_local "$DUMP"

echo 'DB sync complete'
