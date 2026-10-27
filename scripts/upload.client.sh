#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$PROJECT_ROOT/scripts/deploy-config.sh"

CLIENT_DIR="$PROJECT_ROOT/CLIENT"

require_deploy_command npm
require_deploy_command rsync
require_deploy_command ssh
require_deploy_command sshpass

echo "==> Installing client dependencies (if needed)"
if [[ ! -d "$CLIENT_DIR/node_modules" ]]; then
    npm --prefix "$CLIENT_DIR" install --no-audit --no-fund
fi

echo "==> Building ETMW Songs client with base href $CLIENT_BASE_HREF"
rm -rf "$CLIENT_DIR/dist/CLIENT"
npm --prefix "$CLIENT_DIR" run build -- --base-href "$CLIENT_BASE_HREF"

DIST_DIR="$CLIENT_DIR/dist/CLIENT/browser"
if [[ ! -f "$DIST_DIR/index.html" ]]; then
    echo "Angular build index.html was not found at $DIST_DIR/index.html"
    exit 1
fi

if ! grep -q "<base href=\"$CLIENT_BASE_HREF\"" "$DIST_DIR/index.html"; then
    echo "Angular build base href does not match $CLIENT_BASE_HREF."
    exit 1
fi

echo "==> Uploading client to $REMOTE_HOST:$REMOTE_WEB_ROOT"
remote_sshpass "mkdir -p '$REMOTE_WEB_ROOT'"
remote_rsync_sshpass --delete \
    --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
    "$DIST_DIR"/ "$REMOTE_HOST:$REMOTE_WEB_ROOT/"

echo "==> Client uploaded: $PUBLIC_SITE_URL"
