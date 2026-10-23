#!/usr/bin/env bash
set -euo pipefail

VERSION="0.8.0"
TAG="v0.8.0-appremote_v2.1.0-auth"
FILENAME="spotify-app-remote-release-${VERSION}.aar"
URL="https://github.com/spotify/android-sdk/releases/download/${TAG}/${FILENAME}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="$REPO_ROOT/plugins/spotify-playback/android/libs"
DEST="$DEST_DIR/$FILENAME"

mkdir -p "$DEST_DIR"

echo "Fetching Spotify Android App Remote ${VERSION} from Spotify's official GitHub release..."
curl --fail --location --show-error --progress-bar "$URL" --output "$DEST.tmp"
mv "$DEST.tmp" "$DEST"

echo "Installed third-party SDK binary at:"
echo "  $DEST"
echo
echo "Track Mirror does not claim authorship of this Spotify binary."
