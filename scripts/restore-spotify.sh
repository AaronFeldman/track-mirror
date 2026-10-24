#!/usr/bin/env bash
set -euo pipefail

APP_NAME="track-mirror"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/$APP_NAME"
MANIFEST="$STATE_DIR/install-manifest.txt"
SPICETIFY_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/spicetify"
EXTENSIONS_DIR="$SPICETIFY_CONFIG_DIR/Extensions"
EXTENSION_NAMES=(
  "track-mirror-friend-activity.js"
  "track-mirror-dom-uri-probe.js"
  "track-mirror-playback.js"
  "track-mirror-remote-bridge.js"
)

log() { printf '[Track Mirror] %s\n' "$*"; }
fail() { printf '[Track Mirror] ERROR: %s\n' "$*" >&2; exit 1; }

command -v spicetify >/dev/null 2>&1 || fail "spicetify is not installed or not in PATH"

SESSION_DIR=""
if [[ -f "$MANIFEST" ]]; then
  SESSION_DIR="$(awk -F= '$1=="session_dir" {sub(/^session_dir=/, ""); print; exit}' "$MANIFEST")"
fi

log "Restoring vanilla Spotify through Spicetify"
spicetify restore

mkdir -p "$EXTENSIONS_DIR"
for extension_name in "${EXTENSION_NAMES[@]}"; do
  target_extension="$EXTENSIONS_DIR/$extension_name"
  if [[ -n "$SESSION_DIR" && -f "$SESSION_DIR/$extension_name.preexisting" ]]; then
    log "Restoring pre-existing $extension_name"
    cp -a "$SESSION_DIR/$extension_name.preexisting" "$target_extension"
  else
    log "Removing Track Mirror extension $extension_name"
    rm -f "$target_extension"
  fi
done

# Restore the exact pre-install Spicetify configuration when available. This
# removes Track Mirror from the enabled-extension list while preserving the
# user's pre-existing themes, extensions, and other settings.
if [[ -n "$SESSION_DIR" && -f "$SESSION_DIR/config-xpui.ini.before" ]]; then
  log "Restoring pre-install Spicetify configuration"
  cp -a "$SESSION_DIR/config-xpui.ini.before" "$SPICETIFY_CONFIG_DIR/config-xpui.ini"
else
  # Older Track Mirror installs may not have a config snapshot. Remove the
  # known Track Mirror extension names explicitly in that case.
  for extension_name in "${EXTENSION_NAMES[@]}"; do
    spicetify config extensions "${extension_name}-" >/dev/null 2>&1 || true
  done
fi

rm -f "$MANIFEST"

log "Restore complete"
log "Track Mirror recovery snapshots remain under $STATE_DIR until you choose to delete them."
