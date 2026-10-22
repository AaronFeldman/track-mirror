#!/usr/bin/env bash
set -euo pipefail

APP_NAME="track-mirror"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/$APP_NAME"
MANIFEST="$STATE_DIR/install-manifest.txt"
SPICETIFY_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/spicetify"
EXTENSION_NAME="track-mirror-friend-activity.js"
TARGET_EXTENSION="$SPICETIFY_CONFIG_DIR/Extensions/$EXTENSION_NAME"

log() { printf '[Track Mirror] %s\n' "$*"; }
fail() { printf '[Track Mirror] ERROR: %s\n' "$*" >&2; exit 1; }

command -v spicetify >/dev/null 2>&1 || fail "spicetify is not installed or not in PATH"

SESSION_DIR=""
if [[ -f "$MANIFEST" ]]; then
  SESSION_DIR="$(awk -F= '$1=="session_dir" {sub(/^session_dir=/, ""); print; exit}' "$MANIFEST")"
fi

log "Restoring vanilla Spotify through Spicetify"
spicetify restore

if [[ -n "$SESSION_DIR" && -f "$SESSION_DIR/$EXTENSION_NAME.preexisting" ]]; then
  log "Restoring pre-existing extension file"
  mkdir -p "$(dirname "$TARGET_EXTENSION")"
  cp -a "$SESSION_DIR/$EXTENSION_NAME.preexisting" "$TARGET_EXTENSION"
else
  log "Removing Track Mirror extension file"
  rm -f "$TARGET_EXTENSION"
fi

# Restore the Spicetify config snapshot if Track Mirror saved one. This is done
# after `spicetify restore` so user extension/theme settings return to their
# exact pre-Track-Mirror state where possible.
if [[ -n "$SESSION_DIR" && -f "$SESSION_DIR/config-xpui.ini.before" ]]; then
  log "Restoring pre-install Spicetify configuration"
  cp -a "$SESSION_DIR/config-xpui.ini.before" "$SPICETIFY_CONFIG_DIR/config-xpui.ini"
fi

rm -f "$MANIFEST"

log "Restore complete"
log "Spotify should now be vanilla with respect to Track Mirror/Spicetify patching."
log "Track Mirror recovery snapshots remain under $STATE_DIR until you choose to delete them."
