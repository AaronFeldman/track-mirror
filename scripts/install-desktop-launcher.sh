#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bin_dir="$HOME/.local/bin"
app_dir="$HOME/.local/share/applications"
launcher="$bin_dir/track-mirror"
desktop_file="$app_dir/track-mirror.desktop"

mkdir -p "$bin_dir" "$app_dir"

install -m 0755 "$repo_dir/scripts/track-mirror-launch.sh" "$launcher"
sed "s|@HOME@|$HOME|g" "$repo_dir/desktop/track-mirror.desktop.in" > "$desktop_file"
chmod 0644 "$desktop_file"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$app_dir" >/dev/null 2>&1 || true
fi

printf 'Installed Track Mirror application launcher.\n'
printf 'Open your application launcher and search for: Track Mirror\n'
printf 'Normal Spotify remains separate and unchanged.\n'
