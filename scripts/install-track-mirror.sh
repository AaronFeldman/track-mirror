#!/usr/bin/env bash
set -euo pipefail

APP_NAME="track-mirror"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/$APP_NAME"
BACKUP_DIR="$STATE_DIR/backups"
MANIFEST="$STATE_DIR/install-manifest.txt"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

for extension_name in "${EXTENSION_NAMES[@]}"; do
  [[ -f "$REPO_ROOT/spicetify/$extension_name" ]] || \
    fail "missing extension: $REPO_ROOT/spicetify/$extension_name"
done

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

for extension_name in "${EXTENSION_NAMES[@]}"; do
  target_extension="$EXTENSIONS_DIR/$extension_name"
  if [[ -f "$target_extension" ]]; then
    cp -a "$target_extension" "$SESSION_DIR/$extension_name.preexisting"
  fi
done

if [[ -f "$SPICETIFY_CONFIG_DIR/config-xpui.ini" ]]; then
  cp -a "$SPICETIFY_CONFIG_DIR/config-xpui.ini" "$SESSION_DIR/config-xpui.ini.before"
fi

log "Ensuring a Spicetify backup is available"
backup_output=""
if ! backup_output="$(spicetify backup 2>&1)"; then
  printf '%s\n' "$backup_output"
  if grep -Fq "A backup is available" <<<"$backup_output" && \
     grep -Fq "Please restore first then backup" <<<"$backup_output"; then
    log "Existing Spicetify backup retained; continuing without replacing it"
  else
    fail "Spicetify backup failed for an unexpected reason"
  fi
else
  printf '%s\n' "$backup_output"
fi

log "Installing Track Mirror proof-of-concept extensions"
for extension_name in "${EXTENSION_NAMES[@]}"; do
  install -m 0644 \
    "$REPO_ROOT/spicetify/$extension_name" \
    "$EXTENSIONS_DIR/$extension_name"
done

log "Enabling Track Mirror extensions"
for extension_name in "${EXTENSION_NAMES[@]}"; do
  spicetify config extensions "$extension_name"
done

log "Applying Spicetify patch"
if ! spicetify apply; then
  log "Apply failed; attempting automatic rollback"
  spicetify restore || true

  for extension_name in "${EXTENSION_NAMES[@]}"; do
    target_extension="$EXTENSIONS_DIR/$extension_name"
    if [[ -f "$SESSION_DIR/$extension_name.preexisting" ]]; then
      cp -a "$SESSION_DIR/$extension_name.preexisting" "$target_extension"
    else
      rm -f "$target_extension"
    fi
  done

  if [[ -f "$SESSION_DIR/config-xpui.ini.before" ]]; then
    cp -a "$SESSION_DIR/config-xpui.ini.before" "$SPICETIFY_CONFIG_DIR/config-xpui.ini"
  fi

  fail "installation failed and rollback was attempted"
fi

EXTENSIONS_JOINED="$(IFS='|'; printf '%s' "${EXTENSION_NAMES[*]}")"
cat > "$MANIFEST" <<EOF_MANIFEST
installed_at=$TIMESTAMP
session_dir=$SESSION_DIR
spotify_path=$SPOTIFY_PATH
prefs_path=$PREFS_PATH
spicetify_version=$SPICETIFY_VERSION
extensions=$EXTENSIONS_JOINED
EOF_MANIFEST

log "Install complete"
log "Recovery manifest: $MANIFEST"
log "To restore the pre-Track-Mirror Spicetify state, run: scripts/restore-spotify.sh"
