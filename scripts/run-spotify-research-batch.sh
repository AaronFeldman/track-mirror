#!/usr/bin/env bash
set -u

# Run a curated Track Mirror Spotify reverse-engineering pass locally while keeping
# Spotify APKs, decompiled output, and REA evidence outside the Git repository.
#
# This script is AI-assisted implementation of the repository owner's workflow
# decision that routine tool-driving, high-volume output, and evidence gathering
# should be batched so owner interaction can focus on substantive architecture,
# UI/UX, product, licensing, commercialization, and release decisions.
#
# Usage:
#   bash scripts/run-spotify-research-batch.sh [SPOTIFY_CAPTURE_DIR]
#
# Default capture directory:
#   newest directory under $HOME/track-mirror-research/spotify-apk/
#
# Environment:
#   JAVA_HOME            Optional; defaults to /usr/lib/jvm/java-21-openjdk when present.
#   REA_JADX_MCP_JAR     Optional; defaults to the Track Mirror REA setup path.

set -o pipefail

RESEARCH_ROOT="${HOME}/track-mirror-research/spotify-apk"
CAPTURE_DIR="${1:-}"

if [[ -z "$CAPTURE_DIR" ]]; then
  CAPTURE_DIR="$(find "$RESEARCH_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n1 | cut -d' ' -f2-)"
fi

if [[ -z "$CAPTURE_DIR" || ! -d "$CAPTURE_DIR" ]]; then
  echo "error: Spotify capture directory not found" >&2
  echo "hint: pass the capture directory explicitly" >&2
  exit 1
fi

APK="$CAPTURE_DIR/apks/base.apk"
if [[ ! -f "$APK" ]]; then
  echo "error: base APK not found: $APK" >&2
  exit 1
fi

if ! command -v rea >/dev/null 2>&1; then
  echo "error: rea is not available on PATH" >&2
  exit 1
fi

if [[ -z "${JAVA_HOME:-}" && -d /usr/lib/jvm/java-21-openjdk ]]; then
  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
fi

if [[ -n "${JAVA_HOME:-}" ]]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi

if [[ -z "${REA_JADX_MCP_JAR:-}" ]]; then
  export REA_JADX_MCP_JAR="$HOME/.local/share/rea/android/jadx-headless-mcp-0.7.1-all.jar"
fi

if [[ ! -f "$REA_JADX_MCP_JAR" ]]; then
  echo "error: REA JADX JAR not found: $REA_JADX_MCP_JAR" >&2
  exit 1
fi

BATCH_ROOT="$CAPTURE_DIR/track-mirror-research-batch"
OUT="$BATCH_ROOT/results"
mkdir -p "$OUT"

SUMMARY="$BATCH_ROOT/SUMMARY.txt"
: > "$SUMMARY"

{
  echo "Track Mirror Spotify research batch"
  echo "capture_dir=$CAPTURE_DIR"
  echo "base_apk=$APK"
  echo "apk_sha256=$(sha256sum "$APK" | awk '{print $1}')"
  echo "rea_version=$(rea --version 2>/dev/null | head -n1)"
  echo "java_version=$(java -version 2>&1 | head -n1)"
  echo "jadx_jar=$REA_JADX_MCP_JAR"
  echo "started_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
} >> "$SUMMARY"

run_case() {
  local name="$1"
  shift
  local file="$OUT/$name.txt"
  local started ended rc
  started=$(date +%s)
  "$@" > "$file" 2>&1
  rc=$?
  ended=$(date +%s)
  printf '%-36s status=%-3s seconds=%-5s lines=%s\n' \
    "$name" "$rc" "$((ended-started))" "$(wc -l < "$file")" >> "$SUMMARY"
  return 0
}

# One package/manifest baseline.
run_case 00-package \
  rea inspect-android-package "$APK"

# Narrow class families and known Android entry points.
run_case 10-class-search-mediasession \
  rea search-android-classes "$APK" com.spotify.mediasession

run_case 11-class-search-mediabrowser \
  rea search-android-classes "$APK" MediaBrowser

run_case 12-class-search-playback \
  rea search-android-classes "$APK" playback

run_case 20-class-media-browser-service \
  rea inspect-android-class "$APK" com.spotify.mediabrowserservice.mediabrowserservice.SpotifyMediaBrowserService

run_case 21-class-media-library-service \
  rea inspect-android-class "$APK" com.spotify.mediabrowserservice.medialibraryservice.SpotifyMediaLibraryService

run_case 22-class-media-button-receiver \
  rea inspect-android-class "$APK" com.spotify.mediasession.mediasession.receiver.MediaButtonReceiver

run_case 23-class-main-activity \
  rea inspect-android-class "$APK" com.spotify.music.SpotifyMainActivity

# Incoming static-reference evidence for the named entry points.
run_case 30-refs-media-browser-service \
  rea trace-android-references "$APK" com.spotify.mediabrowserservice.mediabrowserservice.SpotifyMediaBrowserService

run_case 31-refs-media-button-receiver \
  rea trace-android-references "$APK" com.spotify.mediasession.mediasession.receiver.MediaButtonReceiver

run_case 32-refs-main-activity \
  rea trace-android-references "$APK" com.spotify.music.SpotifyMainActivity

# Preserve a small, human-readable set of manifest facts without dumping the full
# decoded manifest into the terminal.
python3 - "$OUT/00-package.txt" "$BATCH_ROOT/manifest-leads.txt" <<'PY'
import re, sys
src, dst = sys.argv[1], sys.argv[2]
text = open(src, 'r', errors='replace').read()
needles = [
    r'android\.media\.action\.MEDIA_PLAY_FROM_SEARCH',
    r'com\.spotify\.mediabrowserservice[^"\\n<]*',
    r'com\.spotify\.mediasession[^"\\n<]*',
    r'android\.media\.browse\.MediaBrowserService',
    r'android\.intent\.action\.VIEW',
    r'open\.spotify\.com',
    r'spotify:track',
    r'play_uri_request',
]
seen = []
for pattern in needles:
    for m in re.finditer(pattern, text, re.IGNORECASE):
        value = m.group(0)
        if value not in seen:
            seen.append(value)
with open(dst, 'w') as f:
    for value in seen:
        f.write(value + '\n')
PY

{
  echo
  echo "completed_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "result_dir=$BATCH_ROOT"
} >> "$SUMMARY"

BUNDLE="$CAPTURE_DIR/track-mirror-research-batch.tar.gz"
tar -C "$CAPTURE_DIR" -czf "$BUNDLE" "$(basename "$BATCH_ROOT")"

# Terminal output is intentionally concise. High-volume evidence stays in files.
echo "Track Mirror Spotify research batch complete."
echo "Summary: $SUMMARY"
echo "Bundle:  $BUNDLE"
echo
echo "Case summary:"
cat "$SUMMARY"
