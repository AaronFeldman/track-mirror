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
- `src-tauri` — thin Tauri command bridge
- `ui` — deliberately small shared UI

The first core behavior preserves the proven desktop semantics:

1. selecting/arming a source does not immediately play the currently displayed track;
2. the first valid event becomes a baseline;
3. the next changed exact Spotify track URI produces a play action;
4. duplicate or out-of-order sequence values do not restart playback;
5. events for an unselected listener are ignored;
6. pause transitions are represented as explicit actions.

## Mobile and desktop adapters

Android and iOS Spotify integrations remain native where required. Existing Kotlin and Swift experiments are adapter prototypes and can be folded into the Tauri mobile plugin boundary rather than becoming separate implementations of Track Mirror's core rules.

The existing Spicetify implementation remains a proven desktop source/playback adapter and reference implementation while the Rust core becomes the canonical home for portable mirroring behavior.

## Ownership / provenance note

The decision to prefer Rust, keep the core framework-independent, use Tauri as a replaceable shell, and preserve native platform adapters is a repository-owner product/architecture direction. AI assistance is being used to draft and implement code and documentation; generated implementation should not be mischaracterized as independently human-authored code.
