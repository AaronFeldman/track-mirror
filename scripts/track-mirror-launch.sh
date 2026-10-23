#!/usr/bin/env bash
set -euo pipefail

if ! command -v spotify-launcher >/dev/null 2>&1; then
  printf 'Track Mirror: spotify-launcher was not found in PATH.\n' >&2
  exit 1
fi

exec spotify-launcher "$@"
