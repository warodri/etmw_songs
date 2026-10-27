#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

bash "$PROJECT_ROOT/scripts/upload.client.sh"
bash "$PROJECT_ROOT/scripts/upload.server.sh"
bash "$PROJECT_ROOT/scripts/configure-apache.sh"

echo "==> ETMW Songs deployed: https://entertomyworld.com/apps/songs"
