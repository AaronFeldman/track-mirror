#!/usr/bin/env bash
set -euo pipefail

APP_NAME="track-mirror"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/$APP_NAME"
BACKUP_DIR="$STATE_DIR/backups"
MANIFEST="$STATE_DIR/install-manifest.txt"
EXTENSION_NAME="track-mirror-friend-activity.js"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_EXTENSION="$REPO_ROOT/spicetify/$EXTENSION_NAME"
SPICETIFY_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/spicetify"
EXTENSIONS_DIR="$SPICETIFY_CONFIG_DIR/Extensions"
TARGET_EXTENSION="$EXTENSIONS_DIR/$EXTENSION_NAME"

log() { printf '[Track Mirror] %s\n' "$*"; }
fail() { printf '[Track Mirror] ERROR: %s\n' "$*" >&2; exit 1; }

command -v spicetify >/dev/null 2>&1 || fail "spicetify is not installed or not in PATH"
[[ -f "$SOURCE_EXTENSION" ]] || fail "missing extension: $SOURCE_EXTENSION"

mkdir -p "$BACKUP_DIR" "$EXTENSIONS_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SESSION_DIR="$BACKUP_DIR/$TIMESTAMP"
mkdir -p "$SESSION_DIR"

log "Running preflight checks"
SPICETIFY_VERSION="$(spicetify --version 2>/dev/null || true)"
SPOTIFY_PATH="$(spicetify config spotify_path 2>/dev/null | tail -n1 || true)"
PREFS_PATH="$(spicetify config prefs_path 2>/dev/null | tail -n1 || true)"

[[ -n "$SPOTIFY_PATH" ]] || fail "Spicetify spotify_path is not configured"
[[ -e "$SPOTIFY_PATH" ]] || fail "Configured Spotify path does not exist: $SPOTIFY_PATH"

log "Saving Track Mirror recovery snapshot"
printf '%s\n' "$SPICETIFY_VERSION" > "$SESSION_DIR/spicetify-version.txt"
printf '%s\n' "$SPOTIFY_PATH" > "$SESSION_DIR/spotify-path.txt"
printf '%s\n' "$PREFS_PATH" > "$SESSION_DIR/prefs-path.txt"

if [[ -f "$TARGET_EXTENSION" ]]; then
  cp -a "$TARGET_EXTENSION" "$SESSION_DIR/$EXTENSION_NAME.preexisting"
fi

if [[ -f "$SPICETIFY_CONFIG_DIR/config-xpui.ini" ]]; then
  cp -a "$SPICETIFY_CONFIG_DIR/config-xpui.ini" "$SESSION_DIR/config-xpui.ini.before"
fi

log "Creating Spicetify backup of vanilla Spotify"
spicetify backup

log "Installing Track Mirror extension"
install -m 0644 "$SOURCE_EXTENSION" "$TARGET_EXTENSION"

log "Enabling extension"
spicetify config extensions "$EXTENSION_NAME"

log "Applying Spicetify patch"
if ! spicetify apply; then
  log "Apply failed; attempting automatic rollback"
  spicetify restore || true
  if [[ -f "$SESSION_DIR/$EXTENSION_NAME.preexisting" ]]; then
    cp -a "$SESSION_DIR/$EXTENSION_NAME.preexisting" "$TARGET_EXTENSION"
  else
    rm -f "$TARGET_EXTENSION"
  fi
  fail "installation failed and rollback was attempted"
fi

cat > "$MANIFEST" <<EOF
installed_at=$TIMESTAMP
session_dir=$SESSION_DIR
spotify_path=$SPOTIFY_PATH
prefs_path=$PREFS_PATH
spicetify_version=$SPICETIFY_VERSION
extension=$TARGET_EXTENSION
EOF

log "Install complete"
log "Recovery manifest: $MANIFEST"
log "To restore vanilla Spotify, run: scripts/restore-spotify.sh"
