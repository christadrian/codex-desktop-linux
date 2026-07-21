#!/usr/bin/env bash
set -eu

runtime_root="${XDG_RUNTIME_DIR:-${CODEX_LINUX_APP_STATE_DIR:?}}"
runtime_dir="$runtime_root/${CODEX_LINUX_APP_ID:-codex-desktop}/app-server-bridge"
socket_path="${CODEX_LINUX_APP_SERVER_BRIDGE_SOCKET:-$runtime_dir/app-server.sock}"
lock_path="${socket_path}.lock"

owned_by_current_user() {
    [ -e "$1" ] && [ "$(stat -c %u -- "$1" 2>/dev/null || printf '%s' -1)" = "$(id -u)" ]
}

socket_accepts_connections() {
    [ -S "$socket_path" ] || return 1
    python3 - "$socket_path" <<'PY'
import socket
import sys

client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
client.settimeout(0.25)
try:
    client.connect(sys.argv[1])
except OSError:
    raise SystemExit(1)
finally:
    client.close()
PY
}

# A forced Electron termination can leave the filesystem socket and ownership
# lock behind even though no authority process remains. Reclaim only paths
# owned by this user, and never touch a socket that still accepts connections.
if [ -e "$lock_path" ] || [ -e "$socket_path" ]; then
    if socket_accepts_connections; then
        :
    elif { [ ! -e "$lock_path" ] || owned_by_current_user "$lock_path"; } &&
        { [ ! -e "$socket_path" ] || owned_by_current_user "$socket_path"; }; then
        rm -f -- "$socket_path" "$lock_path"
        printf 'WARN: shared-app-server-socket: removed stale socket ownership at %s\n' "$socket_path" >&2
    fi
fi

printf 'env CODEX_LINUX_APP_SERVER_BRIDGE_SOCKET=%s\n' "$socket_path"
