#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bin_dir="$HOME/.local/bin"
app_dir="$HOME/.local/share/applications"
libexec_dir="$HOME/.local/libexec/track-mirror"
launcher="$bin_dir/track-mirror"
remote_info="$bin_dir/track-mirror-remote-info"
desktop_file="$app_dir/track-mirror.desktop"

mkdir -p "$bin_dir" "$app_dir" "$libexec_dir"

install -m 0755 "$repo_dir/scripts/track-mirror-launch.sh" "$launcher"
install -m 0755 "$repo_dir/scripts/track-mirror-remote-info.sh" "$remote_info"
install -m 0755 "$repo_dir/scripts/track-mirror-remote-server.py" "$libexec_dir/track-mirror-remote-server.py"
install -m 0644 "$repo_dir/remote/index.html" "$libexec_dir/remote-index.html"

sed "s|@HOME@|$HOME|g" "$repo_dir/desktop/track-mirror.desktop.in" > "$desktop_file"
chmod 0644 "$desktop_file"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$app_dir" >/dev/null 2>&1 || true
fi

printf 'Installed Track Mirror application launcher and phone remote bridge.\n'
printf 'Open your application launcher and search for: Track Mirror\n'
printf 'After Track Mirror starts, run: track-mirror-remote-info\n'
printf 'Normal Spotify remains separate and unchanged.\n'
