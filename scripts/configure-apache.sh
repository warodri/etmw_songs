#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$PROJECT_ROOT/scripts/deploy-config.sh"

require_deploy_command ssh
require_deploy_command sshpass

echo "==> Configuring Apache proxy $API_PROXY_PATH -> http://127.0.0.1:$API_PORT/api"
remote_sshpass "API_PORT='$API_PORT' API_PROXY_PATH='$API_PROXY_PATH' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

VHOST="/etc/apache2/sites-available/entertomyworld.com-le-ssl.conf"
if [[ ! -f "$VHOST" ]]; then
    echo "Apache vhost not found at $VHOST"
    exit 1
fi

cp "$VHOST" "$VHOST.bak-$(date +%s)"

python3 - <<'PY'
import os
from pathlib import Path

path = Path('/etc/apache2/sites-available/entertomyworld.com-le-ssl.conf')
text = path.read_text()
marker = '# ETMW Songs API'
port = os.environ['API_PORT']
base = os.environ['API_PROXY_PATH']

if marker in text:
    print('Apache proxy already configured.')
else:
    block = (
        '    # ETMW Songs API\n'
        f'    ProxyPass {base} http://127.0.0.1:{port}/api timeout=90\n'
        f'    ProxyPassReverse {base} http://127.0.0.1:{port}/api\n'
        '\n'
    )
    if '    SSLEngine on' not in text:
        raise SystemExit('Could not find "SSLEngine on" in the vhost.')
    text = text.replace('    SSLEngine on', block + '    SSLEngine on', 1)
    path.write_text(text)
    print('Apache proxy inserted.')
PY

apache2ctl configtest
systemctl reload apache2
REMOTE_SCRIPT

echo "==> Apache reloaded."
