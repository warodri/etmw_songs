#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$PROJECT_ROOT/scripts/deploy-config.sh"

SERVER_DIR="$PROJECT_ROOT/SERVER"

require_deploy_command npm
require_deploy_command rsync
require_deploy_command ssh
require_deploy_command sshpass

echo "==> Installing server dependencies (if needed)"
if [[ ! -d "$SERVER_DIR/node_modules" ]]; then
    npm --prefix "$SERVER_DIR" install --no-audit --no-fund
fi

echo "==> Building ETMW Songs server"
npm --prefix "$SERVER_DIR" run build

if [[ ! -f "$SERVER_DIR/dist/server.js" ]]; then
    echo "Server build output not found at $SERVER_DIR/dist/server.js"
    exit 1
fi

echo "==> Preparing remote server directory"
remote_sshpass "mkdir -p '$REMOTE_SERVER_DIR' '$REMOTE_SERVER_DIR/storage/songs' '$REMOTE_ENV_DIR'"

echo "==> Uploading server (preserving production env and songs)"
remote_rsync_sshpass --delete \
    --exclude 'node_modules/' \
    --exclude '.env' \
    --exclude 'logs/' \
    --exclude 'storage/' \
    "$SERVER_DIR"/ "$REMOTE_HOST:$REMOTE_SERVER_DIR/"

if ! remote_sshpass "test -f '$REMOTE_SERVER_ENV_FILE'"; then
    if [[ ! -f "$SERVER_DIR/.env" ]]; then
        echo "Remote env file does not exist and local SERVER/.env was not found."
        exit 1
    fi
    echo "==> Uploading initial environment file"
    remote_rsync_sshpass --chmod=Fu=rw,Fgo= \
        "$SERVER_DIR/.env" "$REMOTE_HOST:$REMOTE_SERVER_ENV_FILE"
    remote_sshpass "chmod 600 '$REMOTE_SERVER_ENV_FILE'"
fi

echo "==> Installing production dependencies and starting pm2 process $PM2_SERVER_NAME"
remote_sshpass "REMOTE_SERVER_DIR='$REMOTE_SERVER_DIR' REMOTE_SERVER_ENV_FILE='$REMOTE_SERVER_ENV_FILE' PM2_SERVER_NAME='$PM2_SERVER_NAME' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

source ~/.nvm/nvm.sh >/dev/null 2>&1 || true
nvm use default --silent >/dev/null 2>&1 || true

cd "$REMOTE_SERVER_DIR"
mkdir -p storage/songs

if [[ ! -f "$REMOTE_SERVER_ENV_FILE" ]]; then
    echo "Production env file not found at $REMOTE_SERVER_ENV_FILE"
    exit 1
fi

cp "$REMOTE_SERVER_ENV_FILE" "$REMOTE_SERVER_DIR/.env"
chmod 600 "$REMOTE_SERVER_DIR/.env"

if [[ -f package-lock.json ]]; then
    npm ci --omit=dev || npm install --omit=dev --no-audit --no-fund
else
    npm install --omit=dev --no-audit --no-fund
fi

export NODE_ENV=production
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save
pm2 describe "$PM2_SERVER_NAME" >/dev/null
REMOTE_SCRIPT

echo "==> Server uploaded to $REMOTE_HOST:$REMOTE_SERVER_DIR"
