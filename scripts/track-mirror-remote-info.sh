#!/usr/bin/env bash
set -euo pipefail

config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/track-mirror"
token_file="$config_dir/remote-token"
port="8765"

if [[ ! -s "$token_file" ]]; then
  printf 'Track Mirror remote token has not been created yet. Start Track Mirror once first.\n' >&2
  exit 1
fi

token="$(tr -d '\r\n' < "$token_file")"
ip=""
if command -v ip >/dev/null 2>&1; then
  ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}' || true)"
fi
if [[ -z "$ip" ]] && command -v hostname >/dev/null 2>&1; then
  ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
fi

if [[ -z "$ip" ]]; then
  printf 'Track Mirror remote is on port %s, but no LAN IPv4 address was detected.\n' "$port"
  printf 'Pairing token: %s\n' "$token"
  exit 0
fi

printf 'Open this on the phone while it is on the same network as the desktop:\n\n'
printf '  http://%s:%s/?token=%s\n\n' "$ip" "$port" "$token"
printf 'The page removes the token from the visible URL after pairing.\n'
