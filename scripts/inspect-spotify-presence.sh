#!/usr/bin/env bash
# Read-only inspection of the Spotify 9.1.92.3058 presence call path.
# Keeps all decompiled third-party source outside the Track Mirror repository.
set -euo pipefail

APK_ROOT="$HOME/track-mirror-research/spotify-apk/9.1.92.3058_147346334"
APK="${1:-$APK_ROOT/apks/base.apk}"
OUTPUT="$APK_ROOT/presence-probe"
EXPECTED='c26e20a8ce9db36fd0b6021542c75abcaf4e923557b8a21058b502e295d62928'

if [[ ! -f "$APK" ]]; then
  printf 'APK not found: %s\n' "$APK" >&2
  exit 1
fi
if ! command -v jadx >/dev/null 2>&1; then
  printf 'jadx command-line tool is not installed or not on PATH. No changes made.\n' >&2
  exit 1
fi
ACTUAL="$(sha256sum "$APK")"
ACTUAL="${ACTUAL%% *}"
if [[ "$ACTUAL" != "$EXPECTED" ]]; then
  printf 'APK fingerprint does not match the researched build.\nExpected: %s\nActual:   %s\nNo decompilation attempted.\n' "$EXPECTED" "$ACTUAL" >&2
  exit 1
fi

mkdir -p "$OUTPUT"
CLASSES=(p.n5c0 p.d4c0 p.iz10 p.w2c0)
ERRORS=0
for CLASS in "${CLASSES[@]}"; do
  printf 'Inspecting %s ...\n' "$CLASS"
  if ! jadx --no-res --show-bad-code -j 2 \
    --single-class "$CLASS" \
    --single-class-output "$OUTPUT/$CLASS.java" \
    "$APK" > "$OUTPUT/$CLASS.log" 2>&1; then
    printf '  Failed (see %s)\n' "$OUTPUT/$CLASS.log" >&2
    ERRORS=$((ERRORS + 1))
  fi
done

{
  printf 'Track Mirror Android presence — static inspection\n'
  printf 'APK SHA256: %s\n' "$ACTUAL"
  printf 'APK: %s\n' "$APK"
  printf 'Results: %s\n' "$OUTPUT"
  printf '\nRelevant code locations (source files remain local):\n'
  if compgen -G "$OUTPUT/*.java" > /dev/null; then
    grep -nE 'SubscribePresenceRequest|PusherChannel|PresenceResponse|UserActivity|UsersActivity|listening-activity|spotify:track:|PresenceListener|connectionId|EsConnectionId' \
      "$OUTPUT"/*.java | head -n 120 || true
  else
    printf '(No source files were produced.)\n'
  fi
  printf '\nClasses attempted: %s\n' "${CLASSES[*]}"
  printf 'Failures: %s\n' "$ERRORS"
} > "$OUTPUT/summary.txt"
printf '\nSummary saved at %s\n' "$OUTPUT/summary.txt"
if (( ERRORS > 0 )); then
  exit 2
fi
