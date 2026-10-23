# Mobile Architecture

Last reviewed: 2026-10-23

## Mobile objective

Track Mirror should support Android and iOS/iPadOS as native follower clients while preserving the core product rule: Track Mirror mirrors track identity/playback state, not Spotify audio. The follower's own Spotify application performs playback.

## Current Spotify-platform constraint

Spotify's supported Android and iOS App Remote SDKs can connect to the Spotify application installed on the same device, obtain the local user's player state, and issue playback commands including playing a Spotify URI.

As of the review date above, Spotify's public developer interfaces do not expose another arbitrary friend's live Listening Activity. The public player/history scopes describe the authenticated user's playback state/history, not a friend's live desktop Listening Activity feed.

Therefore the mobile architecture must not assume that Android or iOS can independently query the same friend feed that the current Spicetify desktop adapter can observe.

## Architecture

Keep the four Track Mirror responsibilities separate:

1. **Source adapter** — observes the selected source listener.
2. **Normalized mirror event** — platform-neutral description of the observed state.
3. **Transport** — moves normalized events to the follower device when source observation occurs elsewhere.
4. **Playback adapter** — commands the follower's own Spotify client.

The current Linux/Spicetify implementation is one source adapter. Android and iOS should initially be native playback/follower adapters.

## First mobile milestone

Build one minimal native client for each platform that can:

- launch independently of Spotify;
- authorize/connect to the installed Spotify application using Spotify App Remote;
- accept a Track Mirror event containing an exact `spotify:track:...` URI;
- play that URI through the user's own Spotify application;
- remember whether mirroring is armed;
- ignore duplicate events for the same URI;
- expose clear connection/error state.

For the first playback test, the event may be entered or injected manually. This isolates and validates the mobile playback adapter before source transport is added.

## Second mobile milestone

Add a small Track Mirror event transport so the already-working desktop source adapter can feed Android/iOS follower clients. The transport should carry normalized metadata/state only and must not carry Spotify audio.

The first transport implementation should favor simplicity and debuggability over premature infrastructure. It should be replaceable later by a direct peer-to-peer, LAN, or hosted relay mechanism without changing the mobile playback adapters.

## Future source options

Longer term, Track Mirror can support more than one source model:

- **Desktop-observed source:** the existing Spicetify adapter observes a friend who has already exposed Listening Activity in Spotify and publishes normalized Track Mirror events.
- **Cooperative Track Mirror source:** a source listener explicitly runs Track Mirror and shares their own normalized playback state with selected followers.
- **Other permitted adapters:** future platform integrations can implement the same source interface if Spotify exposes a supported mechanism.

These source models should be interchangeable from the sync engine's point of view.

## Android direction

Use Spotify's Android App Remote SDK for the follower playback adapter. The Android client can be developed and built on Linux. Do not embed or relay Spotify audio.

## iOS/iPadOS direction

Use Spotify's iOS SDK/App Remote for the follower playback adapter. The repository can contain the complete Swift source and project structure, but building/signing/testing on a physical iPhone or iPad requires Apple's Xcode toolchain on macOS.

## Shared event model

The mobile clients should consume the same normalized event shape documented in `mobile/PROTOCOL.md`. Platform-native models may be generated or implemented separately, but field names and semantics should stay aligned.

## Non-goals

- Reimplementing the Spotify audio player.
- Relaying Spotify audio between devices.
- Treating the follower as the source listener's Spotify device.
- Depending on catalog search when an exact track URI is already known.
- Scraping the mobile Spotify UI as the primary production architecture.
