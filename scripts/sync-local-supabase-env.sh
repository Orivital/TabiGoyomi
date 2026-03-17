#!/usr/bin/env bash

set -euo pipefail

env_file="${1:-.env.local}"

if [ ! -f "$env_file" ]; then
  cp .env.example "$env_file"
fi

status_file="$(mktemp)"
cleanup() {
  rm -f "$status_file"
}
trap cleanup EXIT

pnpm exec supabase status -o env > "$status_file"

read_status_value() {
  local key="$1"
  awk -F= -v target="$key" '
    $1 == target {
      value = substr($0, length(target) + 2)
      gsub(/^"/, "", value)
      gsub(/"$/, "", value)
      print value
      exit
    }
  ' "$status_file"
}

upsert_env_value() {
  local key="$1"
  local value="$2"
  local escaped

  escaped="$(printf '%s' "$value" | sed 's/[\/&]/\\&/g')"

  if grep -q "^${key}=" "$env_file"; then
    sed -i "s/^${key}=.*/${key}=${escaped}/" "$env_file"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$env_file"
  fi
}

api_url="$(read_status_value API_URL)"
anon_key="$(read_status_value ANON_KEY)"
publishable_key="$(read_status_value PUBLISHABLE_KEY)"

if [ -z "$api_url" ] || [ -z "$anon_key" ]; then
  echo "Failed to read API_URL or ANON_KEY from 'supabase status -o env'." >&2
  exit 1
fi

if [ -z "$publishable_key" ]; then
  publishable_key="$anon_key"
fi

upsert_env_value "VITE_SUPABASE_URL" "$api_url"
upsert_env_value "VITE_SUPABASE_PUBLISHABLE_KEY" "$publishable_key"
upsert_env_value "VITE_SUPABASE_ANON_KEY" "$anon_key"

echo "Updated ${env_file} with the current local Supabase API URL and public keys."
