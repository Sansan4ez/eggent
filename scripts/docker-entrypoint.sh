#!/usr/bin/env bash
set -euo pipefail

fix_auth_dir() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    return 0
  fi

  # data/ can be bind-mounted with root ownership from host;
  # fix only OAuth directories to keep startup fast and scoped.
  sudo chown node:node "$dir" >/dev/null 2>&1 || true
  sudo chmod 700 "$dir" >/dev/null 2>&1 || true
}

fix_auth_file() {
  local file_path="$1"
  if [[ ! -f "$file_path" ]]; then
    return 0
  fi

  sudo chown node:node "$file_path" >/dev/null 2>&1 || true
  sudo chmod 600 "$file_path" >/dev/null 2>&1 || true
}

# Bind-mounted ./data is often created as root on VPS hosts. The container runs
# as node (uid 1000), so fix ownership before creating pi-agent/cache dirs.
DATA_ROOT="/app/data"
PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-/app/data/pi-agent}"
RUNTIME_DIRS=(
  "$PI_AGENT_DIR"
  "${TMPDIR:-/app/data/tmp}"
  "${PLAYWRIGHT_BROWSERS_PATH:-/app/data/ms-playwright}"
  "${npm_config_cache:-/app/data/npm-cache}"
  "${XDG_CACHE_HOME:-/app/data/.cache}"
)

# Do not hide failures here: continuing with an unwritable bind mount only
# produces a less useful EACCES error later in ensure-pi-packages.mjs.
sudo mkdir -p "$DATA_ROOT" "${RUNTIME_DIRS[@]}"
sudo chown node:node "$DATA_ROOT"
for dir in "${RUNTIME_DIRS[@]}"; do
  sudo chown -R node:node "$dir"
  sudo chmod u+rwX "$dir"
done

fix_auth_dir "/app/data/.codex"
fix_auth_dir "/app/data/.gemini"

fix_auth_file "/app/data/.codex/auth.json"
fix_auth_file "/app/data/.gemini/oauth_creds.json"
sudo chmod 700 "$PI_AGENT_DIR"

fix_auth_file "/app/data/.gemini/settings.json"

node /app/scripts/ensure-pi-packages.mjs

exec npm run start
