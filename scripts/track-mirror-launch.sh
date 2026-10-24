#!/usr/bin/env bash
set -euo pipefail

if ! command -v spotify-launcher >/dev/null 2>&1; then
  printf 'Track Mirror: spotify-launcher was not found in PATH.\n' >&2
  exit 1
fi

remote_server="${TRACK_MIRROR_REMOTE_SERVER:-$HOME/.local/libexec/track-mirror/track-mirror-remote-server.py}"
state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/track-mirror"
pid_file="$state_dir/remote-server.pid"
remote_log="$state_dir/remote-server.log"

start_remote_server() {
  [[ -f "$remote_server" ]] || return 0
  command -v python3 >/dev/null 2>&1 || return 0

  if [[ -f "$pid_file" ]]; then
    remote_pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ "$remote_pid" =~ ^[0-9]+$ ]] && kill -0 "$remote_pid" 2>/dev/null; then
      return 0
    fi
  fi

  mkdir -p "$state_dir"
  nohup python3 "$remote_server" --quiet >>"$remote_log" 2>&1 </dev/null &
}

start_remote_server
exec spotify-launcher "$@"
