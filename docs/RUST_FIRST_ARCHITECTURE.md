# Rust-first cross-platform architecture

Date adopted: 2026-10-23

## Decision

Track Mirror is a Rust application core with replaceable platform shells and adapters.

Tauri 2 is the initial cross-platform shell for Windows, macOS, Android, iOS/iPadOS, and later Linux consolidation, but the Track Mirror product logic must not depend on Tauri.

The intended dependency direction is:

```text
platform source/playback adapters
            |
            v
      Tauri/native bridge
            |
            v
    track-mirror-core (Rust)
            ^
            |
       shared thin UI
```

`track-mirror-core` must remain usable as an ordinary Rust library without Tauri, WebView, Kotlin, Swift, Spotify SDK, operating-system UI, or filesystem assumptions.

## What belongs in the Rust core

- normalized mirror-event model
- protocol compatibility rules
- selected-source state
- armed/disarmed state
- baseline behavior
- duplicate and out-of-order suppression
- stale-state rules
- play/pause/seek decisions
- timing and drift reconciliation
- transport-neutral synchronization logic
- policy about when an observed source change should become a follower action

## What does not belong in the Rust core

- Spotify Android App Remote calls
- Spotify iOS App Remote calls
- Spicetify/Spotify DOM access
- Windows or macOS client automation
- Tauri windowing or WebView APIs
- Android lifecycle code
- Apple application lifecycle code
- platform credentials, signing, packaging, or app-store configuration

Those are adapters around the core.

## Why this boundary matters

The repository owner prefers Rust and wants Track Mirror to have a unified codebase across Windows 11, macOS, Android, and Apple mobile devices without making the product dependent on the survival of one application framework.

If Tauri remains healthy, it provides a convenient common shell. If Tauri is replaced in the future, the Rust core should remain intact and be callable from another shell or from native Kotlin/Swift bindings.

## Initial implementation

The Cargo workspace begins with:

- `crates/track-mirror-core` — framework-independent Rust state and decision engine
- `plugins/spotify-playback` — thin Tauri mobile playback bridge
- `src-tauri` — thin Tauri command/application shell
- `ui` — deliberately small shared UI

The first core behavior preserves the proven desktop semantics:

1. selecting/arming a source does not immediately play the currently displayed track;
2. the first valid event becomes a baseline;
3. the next changed exact Spotify track URI produces a play action;
4. duplicate or out-of-order sequence values do not restart playback;
5. events for an unselected listener are ignored;
6. pause transitions are represented as explicit actions.

## Rust-to-native mobile playback boundary

The first mobile bridge uses this flow:

```text
MirrorEvent
    |
    v
track-mirror-core::MirrorEngine
    |
    v
MirrorAction
    |
    +-- Ignored/Baseline --> no Spotify call
    |
    +-- PlayTrack --------> Tauri Rust plugin --> Kotlin/Swift --> Spotify App Remote
    |
    +-- Pause ------------> Tauri Rust plugin --> Kotlin/Swift --> Spotify App Remote
```

The Rust shell owns the decision to play or pause. Native Kotlin and Swift code do not implement friend selection, stale-baseline behavior, duplicate suppression, event ordering, or synchronization policy.

The native plugin contract is intentionally narrow:

- configure Spotify application identity and redirect URI;
- connect;
- play an exact `spotify:track:` URI;
- pause;
- disconnect;
- handle the Spotify authorization callback where the platform requires it.

The shared WebView UI does not invoke native plugin commands directly. It calls Rust/Tauri application commands; Rust processes the event first and dispatches only actionable `MirrorAction` values to the native adapter.

### Android

The Android plugin is Kotlin and uses Spotify Android App Remote. Spotify's App Remote binary remains third-party material and is not committed into the Track Mirror repository. A fetch script retrieves the official binary into an ignored `libs/` path for local builds.

### iOS/iPadOS

The Apple plugin is Swift and uses Spotify iOS App Remote. When Spotify is not connected, the adapter uses Spotify's authorization/play flow for the exact mirrored URI and accepts the callback through Track Mirror's registered `trackmirror://` deep-link scheme. The Rust core remains unaware of that application-switch lifecycle.

## Mobile and desktop adapters

Android and iOS Spotify integrations remain native where required. Earlier standalone Kotlin and Swift experiments are adapter prototypes; the canonical path now folds their responsibilities into the Tauri mobile plugin boundary rather than creating separate implementations of Track Mirror's core rules.

The existing Spicetify implementation remains a proven desktop source/playback adapter and reference implementation while the Rust core is the canonical home for portable mirroring behavior.

Windows and macOS playback/source adapters will follow the same rule: platform code may perform platform-specific I/O, but mirroring policy remains in Rust.

## Validation rule

A compiled Rust/Tauri bridge is not the same as a validated mobile implementation. Android and iOS remain unvalidated until the generated Tauri mobile projects compile against the native Spotify SDKs and the full sequence is exercised on real devices:

1. configure Spotify;
2. authorize/connect;
3. arm Track Mirror;
4. accept a first baseline event without playback;
5. accept a changed exact track URI;
6. receive `MirrorAction::PlayTrack` from the Rust core;
7. hear the follower's own Spotify app play that track;
8. verify pause and reconnect behavior.

## Ownership / provenance note

The decision to prefer Rust, keep the core framework-independent, use Tauri as a replaceable shell, and preserve native platform adapters is a repository-owner product/architecture direction. AI assistance is being used to draft and implement code and documentation; generated implementation should not be mischaracterized as independently human-authored code.
