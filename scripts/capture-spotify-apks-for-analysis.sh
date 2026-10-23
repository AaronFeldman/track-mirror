#!/usr/bin/env bash
set -euo pipefail

# Capture the exact installed Spotify Android package set for local reverse-engineering research.
#
# Spotify APKs and split APKs are third-party material. This script deliberately stores them
# outside the Track Mirror repository by default and never commits or redistributes them.
#
# Usage:
#   bash scripts/capture-spotify-apks-for-analysis.sh [ADB_SERIAL]
#
# Optional environment:
#   TRACK_MIRROR_RESEARCH_DIR=/absolute/path
#
# Default research root:
#   $HOME/track-mirror-research

PACKAGE="com.spotify.music"
SERIAL="${1:-${ADB_SERIAL:-}}"
RESEARCH_ROOT="${TRACK_MIRROR_RESEARCH_DIR:-$HOME/track-mirror-research}"

if ! command -v adb >/dev/null 2>&1; then
  echo "error: adb is not available on PATH" >&2
  exit 1
fi

adb_cmd=(adb)
if [[ -n "$SERIAL" ]]; then
  adb_cmd+=( -s "$SERIAL" )
fi

if ! "${adb_cmd[@]}" get-state >/dev/null 2>&1; then
  echo "error: no usable Android device is available${SERIAL:+ at serial $SERIAL}" >&2
  echo "hint: run 'adb devices -l' and pass the desired serial as the first argument" >&2
  exit 1
fi

if ! "${adb_cmd[@]}" shell pm path "$PACKAGE" >/dev/null 2>&1; then
  echo "error: Spotify package $PACKAGE is not installed on the selected Android device" >&2
  exit 1
fi

package_dump="$("${adb_cmd[@]}" shell dumpsys package "$PACKAGE")"
version_name="$(printf '%s\n' "$package_dump" | sed -n 's/^[[:space:]]*versionName=//p' | head -n1 | tr -d '\r')"
version_code="$(printf '%s\n' "$package_dump" | sed -n 's/^[[:space:]]*versionCode=\([0-9][0-9]*\).*/\1/p' | head -n1 | tr -d '\r')"

version_name="${version_name:-unknown-version}"
version_code="${version_code:-unknown-code}"

safe_version_name="$(printf '%s' "$version_name" | tr -c 'A-Za-z0-9._-' '_')"
target_dir="$RESEARCH_ROOT/spotify-apk/${safe_version_name}_${version_code}"
mkdir -p "$target_dir"

printf '%s\n' "$package_dump" > "$target_dir/package-dumpsys.txt"
"${adb_cmd[@]}" shell pm path "$PACKAGE" | tr -d '\r' > "$target_dir/package-paths.txt"

{
  echo "package=$PACKAGE"
  echo "versionName=$version_name"
  echo "versionCode=$version_code"
  echo "adbSerial=${SERIAL:-auto}"
  echo "capturedUtc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$target_dir/capture-metadata.txt"

mapfile -t remote_paths < <(sed -n 's/^package://p' "$target_dir/package-paths.txt")
if [[ ${#remote_paths[@]} -eq 0 ]]; then
  echo "error: Android reported no APK paths for $PACKAGE" >&2
  exit 1
fi

mkdir -p "$target_dir/apks"
: > "$target_dir/pull-map.tsv"

for remote_path in "${remote_paths[@]}"; do
  base_name="$(basename "$remote_path")"
  local_path="$target_dir/apks/$base_name"
  printf 'pulling %s\n' "$remote_path"
  "${adb_cmd[@]}" pull "$remote_path" "$local_path" >/dev/null
  printf '%s\t%s\n' "$remote_path" "$local_path" >> "$target_dir/pull-map.tsv"
done

(
  cd "$target_dir/apks"
  sha256sum ./*.apk | sort
) > "$target_dir/SHA256SUMS"

{
  echo "# Spotify APK archive inventory"
  echo
  for apk in "$target_dir"/apks/*.apk; do
    echo "## $(basename "$apk")"
    if command -v unzip >/dev/null 2>&1; then
      unzip -l "$apk"
    else
      echo "unzip not installed; archive inventory skipped"
    fi
    echo
  done
} > "$target_dir/archive-inventory.txt"

if command -v unzip >/dev/null 2>&1; then
  {
    echo "# Native libraries present in captured Spotify APKs"
    for apk in "$target_dir"/apks/*.apk; do
      unzip -Z1 "$apk" 2>/dev/null | grep -E '^lib/[^/]+/[^/]+\.so$' | sed "s#^#$(basename "$apk")\t#" || true
    done
  } > "$target_dir/native-libraries.tsv"
fi

cat > "$target_dir/README.txt" <<EOF
Track Mirror local Spotify reverse-engineering capture

Package:     $PACKAGE
Version:     $version_name
VersionCode: $version_code

This directory contains third-party Spotify APK material captured from a device
for local interoperability/research analysis. Do not commit these APKs, split APKs,
native libraries, or decompiled Spotify code to the Track Mirror repository.

Recommended analysis order:
1. REA + headless JADX on the base APK for Android/DEX structure and references.
2. Search MediaSession/PlaybackState/TransportControls-related classes and call chains.
3. Inspect split APKs as needed for code/resources not present in the base APK.
4. Use Ghidra only when the relevant Java/Kotlin path crosses JNI/native libraries.
5. Confirm any static conclusion with a controlled runtime MediaSession test.

Primary Track Mirror questions:
- Does Spotify advertise ACTION_PLAY_FROM_URI at runtime?
- Where is the corresponding MediaSession callback implemented?
- Does the callback accept spotify:track:<id> URIs?
- Does MEDIA_ID use spotify:track:<id> and feed the same playback path?
- Are playFromMediaId or playFromSearch routed differently?
- Which native libraries, if any, receive the resulting playback request?
EOF

printf '\nCapture complete.\n'
printf 'Research directory: %s\n' "$target_dir"
printf 'APK count: %s\n' "${#remote_paths[@]}"
printf 'Hashes: %s\n' "$target_dir/SHA256SUMS"
printf '\nNothing was written under the Track Mirror Git repository.\n'
