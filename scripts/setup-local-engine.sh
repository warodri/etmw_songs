#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_KEY="$(sed -n 's/^GENERATION_API_KEY=//p' "$PROJECT_ROOT/SERVER/.env" | head -n 1)"
if [[ -z "$API_KEY" ]]; then
    echo "GENERATION_API_KEY was not found in SERVER/.env"
    exit 1
fi
export HEARTMULA_API_KEY="$API_KEY"
TUNNEL_NAME="songs"
TUNNEL_PORT="8000"

echo "==> Stopping any manually started API process on port ${TUNNEL_PORT}"
PIDS="$(lsof -nP -iTCP:${TUNNEL_PORT} -sTCP:LISTEN -t 2>/dev/null || true)"
if [[ -n "$PIDS" ]]; then
    kill $PIDS 2>/dev/null || true
    sleep 2
fi

echo "==> Registering the local HeartMuLa API with pm2"
pm2 delete songs-api >/dev/null 2>&1 || true
pm2 start "$PROJECT_ROOT/ecosystem.config.cjs" --only songs-api
pm2 save

echo "==> Adding the Janus tunnel '${TUNNEL_NAME}' -> http://localhost:${TUNNEL_PORT}"
node - <<NODE
const fs = require('fs');
const path = process.env.HOME + '/.janus/config.json';
const config = JSON.parse(fs.readFileSync(path, 'utf8'));
config.mode = 'expert';
config.tunnels = [
    ...(config.tunnels || []).filter(tunnel => tunnel.name !== '${TUNNEL_NAME}'),
    { name: '${TUNNEL_NAME}', protocol: 'http', host: 'localhost', port: ${TUNNEL_PORT} },
];
fs.writeFileSync(path, JSON.stringify(config, null, 4) + '\n');
console.log('Janus config updated.');
NODE

pm2 restart janus >/dev/null
echo "==> Waiting for the HeartMuLa model to load (this can take several minutes)"
for attempt in $(seq 1 120); do
    if curl -fsS "http://127.0.0.1:${TUNNEL_PORT}/health" >/dev/null 2>&1; then
        echo "Local API is ready."
        break
    fi
    sleep 10
done

echo "==> Public tunnel health"
curl -fsS "https://${TUNNEL_NAME}--warodri.entertomyworld.com/health" || {
    echo "Tunnel is not answering yet. Check: pm2 logs janus --lines 80"
    exit 1
}
echo
echo "Engine is available at https://${TUNNEL_NAME}--warodri.entertomyworld.com"
