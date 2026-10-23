# Track Mirror for Android

Status: mobile foundation / first native playback milestone.

## Goal

The Android app is initially a follower client. It receives a normalized Track Mirror event containing an exact Spotify track URI and asks the Spotify app installed on the same Android device to play that URI.

It does not stream Spotify audio itself.

## Spotify integration

Use Spotify's supported Android App Remote SDK. Spotify currently documents Android App Remote as capable of connecting to the installed Spotify app, playing a Spotify URI, and subscribing to local PlayerState.

The Spotify Android SDK is distributed by Spotify. Do not commit Spotify's SDK binaries into Track Mirror unless redistribution terms have been reviewed. For development, download/import the App Remote AAR using Spotify's current instructions.

The current Spotify documentation requires:

- a Spotify Developer application/client ID;
- an Android package name and application fingerprint registered in the Spotify Developer Dashboard;
- a registered redirect URI;
- the Spotify Android application installed on the test device;
- the `app-remote-control` authorization flow.

## Initial source files

- `app/src/main/java/com/trackmirror/mobile/MirrorEvent.kt` — platform representation of the shared event in `mobile/PROTOCOL.md`.
- `app/src/main/java/com/trackmirror/mobile/SpotifyPlaybackAdapter.kt` — thin App Remote playback adapter with duplicate-track suppression.

## First test milestone

1. Create/open a minimal Android Studio project under this directory.
2. Import Spotify's current App Remote SDK according to Spotify's documentation.
3. Insert the Track Mirror Spotify client ID and redirect URI through local build configuration; do not commit private credentials.
4. Connect/authorize through `SpotifyPlaybackAdapter`.
5. Inject one manual `MirrorEvent` containing an exact `spotify:track:...` URI.
6. Confirm that the installed Spotify application plays the requested track.

After this works, connect the same adapter to the Track Mirror mobile transport rather than a manual test event.

## Linux development

Android development can be performed from the existing Linux/CachyOS development machine using Android Studio/Gradle and an Android device with developer mode/USB debugging or wireless debugging enabled.
