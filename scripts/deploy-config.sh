#!/usr/bin/env bash
set -euo pipefail

SONGS_ROOT="${SONGS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-$SONGS_ROOT/.env.deploy}"

trim_env_value() {
    local value="$1"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf '%s' "$value"
}

parse_env_assignment() {
    local line="$1"
    PARSED_ENV_KEY=""
    PARSED_ENV_VALUE=""
    line="${line%$'\r'}"
    line="$(trim_env_value "$line")"

    if [[ -z "$line" || "${line:0:1}" == "#" ]]; then
        return 1
    fi

    if [[ "$line" =~ ^export[[:space:]]+(.+)$ ]]; then
        line="${BASH_REMATCH[1]}"
    fi

    if [[ ! "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
        echo "Invalid env line: $line"
        exit 1
    fi

    PARSED_ENV_KEY="${line%%=*}"
    PARSED_ENV_VALUE="$(trim_env_value "${line#*=}")"

    if [[ ${#PARSED_ENV_VALUE} -ge 2 ]]; then
        if [[ "${PARSED_ENV_VALUE:0:1}" == '"' && "${PARSED_ENV_VALUE: -1}" == '"' ]]; then
            PARSED_ENV_VALUE="${PARSED_ENV_VALUE:1:${#PARSED_ENV_VALUE}-2}"
        elif [[ "${PARSED_ENV_VALUE:0:1}" == "'" && "${PARSED_ENV_VALUE: -1}" == "'" ]]; then
            PARSED_ENV_VALUE="${PARSED_ENV_VALUE:1:${#PARSED_ENV_VALUE}-2}"
        fi
    fi

    return 0
}

if [[ -f "$DEPLOY_ENV_FILE" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
        if parse_env_assignment "$line"; then
            export "$PARSED_ENV_KEY=$PARSED_ENV_VALUE"
        fi
    done < "$DEPLOY_ENV_FILE"
fi

REMOTE_HOST="${REMOTE_HOST:-root@entertomyworld.com}"
REMOTE_PASSWORD="${REMOTE_PASSWORD:-}"
REMOTE_APP_ROOT="${REMOTE_APP_ROOT:-/opt}"
REMOTE_ENV_DIR="${REMOTE_ENV_DIR:-/etc/songs}"
REMOTE_WEB_ROOT="${REMOTE_WEB_ROOT:-/var/www/entertomyworld.com/apps/songs}"
REMOTE_SERVER_DIR="${REMOTE_SERVER_DIR:-$REMOTE_APP_ROOT/songs/server}"
REMOTE_SERVER_ENV_FILE="${REMOTE_SERVER_ENV_FILE:-$REMOTE_ENV_DIR/server.env}"
PM2_SERVER_NAME="${PM2_SERVER_NAME:-songs-server}"
CLIENT_BASE_HREF="${CLIENT_BASE_HREF:-/apps/songs/}"
PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-https://entertomyworld.com/apps/songs}"
API_PROXY_PATH="${API_PROXY_PATH:-/apps/songs/api}"
API_PORT="${API_PORT:-3025}"
SSH_OPTS="${SSH_OPTS:- -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15}"

require_deploy_command() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Required command not found: $command_name"
        exit 1
    fi
}

remote_sshpass() {
    SSHPASS="$REMOTE_PASSWORD" sshpass -e ssh $SSH_OPTS "$REMOTE_HOST" "$@"
}

remote_rsync_sshpass() {
    SSHPASS="$REMOTE_PASSWORD" sshpass -e rsync -avz -e "ssh $SSH_OPTS" "$@"
}
