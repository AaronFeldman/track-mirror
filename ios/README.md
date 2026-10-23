# Track Mirror for iOS / iPadOS

Status: mobile foundation / first native playback milestone.

## Goal

The iOS/iPadOS app is initially a follower client. It receives a normalized Track Mirror event containing an exact Spotify track URI and asks the Spotify app installed on the same device to play that URI.

It does not stream Spotify audio itself.

## Spotify integration

Use Spotify's supported iOS SDK / App Remote. Spotify currently documents App Remote as capable of authorizing through the Spotify app, playing a track by URI, and subscribing to local player-state changes.

The initial Track Mirror implementation should use Spotify's SDK as a dependency rather than vendoring a modified Spotify client or implementing playback itself.

The current Spotify setup requires:

- a Spotify Developer application/client ID;
- an iOS bundle identifier registered in the Spotify Developer Dashboard;
- a registered redirect URI / URL scheme;
- the Spotify iOS application installed on the test device;
- the `app-remote-control` authorization flow.

## Initial source files

- `TrackMirror/MirrorEvent.swift` — Swift representation of `mobile/PROTOCOL.md`.
- `TrackMirror/SpotifyPlaybackAdapter.swift` — thin App Remote playback adapter with duplicate-track suppression.

## First test milestone

1. Create/open an Xcode project under this directory.
2. Add Spotify's current iOS SDK using Spotify's supported integration method.
3. Configure the Track Mirror client ID, bundle identifier and redirect URI locally; do not commit private credentials.
4. Authorize/connect through `SpotifyPlaybackAdapter`.
5. Inject one manual `MirrorEvent` containing an exact `spotify:track:...` URI.
6. Confirm that the installed Spotify application plays the requested track.

After this works, connect the same adapter to the Track Mirror mobile transport rather than a manual test event.

## Build requirement

The repository can be edited from any platform, but building, signing and testing a native iPhone/iPad application requires Apple's Xcode toolchain on macOS and a physical device for Spotify App Remote testing.

## iOS lifecycle note

Spotify's current App Remote documentation requires app switching to wake the Spotify app in some states. Track Mirror should make that behavior explicit in the UI and should not silently pretend that continuous background control is guaranteed when iOS has suspended the Track Mirror app.
