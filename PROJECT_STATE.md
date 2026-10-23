# Track Mirror — Canonical Project State

Last updated: 2026-10-23

## Core concept

Track Mirror is a Spotify companion application that mirrors track identity and playback state between listeners. It does not rebroadcast or proxy Spotify audio. Each listener's own Spotify client performs playback.

## Current product direction

- Follow a selected friend's listening activity closely enough that the follower's own Spotify client can play the corresponding tracks.
- Prefer the term **mirroring** rather than rebroadcasting.
- Move away from OCR/screen scraping where practical.
- Use a Spicetify extension as the current discovery/integration path for Spotify desktop Listening Activity.
- Keep implementation compatible with Spotify platform rules and third-party licenses.
- Distribute Track Mirror and its integration logic, not patched Spotify binaries.
- Treat complete rollback/recovery as a core product requirement.
- Keep the core architecture portable across Linux, Windows 11, macOS, Android, and iOS/iPadOS; treat the current Linux/Spicetify implementation as a platform-specific adapter/test bed.
- As of October 23, 2026, prioritize Android and iOS/iPadOS follower development as first-class product targets while also designing for Windows 11 and macOS from the same shared foundation.
- Use a **Rust-first architecture**: the durable Track Mirror state/synchronization engine belongs in a plain Rust crate with no Tauri dependency.
- Use **Tauri 2 as the initial replaceable cross-platform shell**, not as the owner of Track Mirror's core business logic.
- Keep native Kotlin, Swift, Windows/macOS, and Spicetify code as thin source/playback/platform adapters around the shared Rust core.

## Existing proof of concept

A local Linux script, `~/.local/bin/follow-amanda`, was used to watch Spotify Friend Activity and detect track changes with desktop automation plus OCR. The proof of concept established that the core follow/mirror experience is useful, but OCR is considered transitional rather than the target architecture.

## Current desktop implementation state

The current non-OCR desktop path is working end to end.

### Listening Activity discovery

`spicetify/track-mirror-friend-activity.js`

This extension runs inside Spotify through Spicetify, detects the rendered **Listening activity** panel, identifies visible friends, extracts visible track/artist text, emits `track-mirror:friend-activity` events, and stores the latest observations in local storage.

### Exact track-URI discovery

`spicetify/track-mirror-dom-uri-probe.js`

This extension probes only the local DOM around already identified Listening Activity rows and recovers exact embedded Spotify track URIs (`spotify:track:...`). This avoids OCR and avoids repeated Spotify catalog-search requests.

### Playback mirroring

`spicetify/track-mirror-playback.js`

This extension provides a user-controlled friend selector plus mirroring ON/OFF control. Enabling mirroring treats the selected friend's currently displayed URI as a baseline, so Track Mirror does not immediately play potentially stale activity. When that selected friend's URI changes, the extension instructs the follower's own Spotify client to play the newly observed exact URI.

### First successful live end-to-end test

On October 22, 2026, the repository owner confirmed the first successful live mirroring event:

1. Amanda's Listening Activity changed to a new track.
2. Track Mirror detected the changed activity row.
3. Track Mirror recovered the exact embedded Spotify track URI from the local client DOM.
4. The armed playback layer detected the URI change.
5. The user's own Spotify client switched to the mirrored track successfully.

This validated the core product behavior without copying, proxying, or rebroadcasting audio.

A Spotify catalog-search resolver was also explored but encountered HTTP 429 rate-limit responses. The successful current path therefore prefers direct embedded track-URI discovery from the local client DOM and does not require catalog search for normal mirroring.

### Desktop launcher

Track Mirror can be registered as a normal per-user desktop application through:

- `scripts/track-mirror-launch.sh`
- `scripts/install-desktop-launcher.sh`
- `desktop/track-mirror.desktop.in`

The ordinary Spotify installation remains separate.

### Installer and rollback

A safety-focused installer/rollback layer exists:

- `scripts/install-track-mirror.sh`
- `scripts/restore-spotify.sh`
- `docs/INSTALL_AND_RECOVERY.md`

The installer performs preflight checks, records a timestamped Track Mirror recovery snapshot, invokes Spicetify's vanilla backup, installs/enables the Track Mirror extension, and attempts automatic restoration if `spicetify apply` fails. The restore script invokes `spicetify restore`, removes or restores the pre-existing Track Mirror extension file, restores the saved Spicetify configuration when available, and leaves recovery snapshots in place for manual disaster recovery.

## Mobile development state

Mobile development began October 23, 2026.

### Shared protocol

`mobile/PROTOCOL.md`

Defines a platform-neutral normalized mirror event. The first version carries source-listener identity, exact Spotify track URI, playing state, observation time, optional metadata/timing, sequence, provenance and confidence. It carries metadata/state only, never Spotify audio.

### Mobile architecture

`docs/MOBILE_ARCHITECTURE.md`

Spotify's supported Android and iOS App Remote SDKs can control the Spotify app installed on the follower's device and play an exact Spotify URI. Spotify's public developer interfaces do not currently expose an arbitrary friend's live Listening Activity, so mobile playback adapters remain separate from source observation.

### Android adapter prototype

- `android/README.md`
- `android/app/src/main/java/com/trackmirror/mobile/MirrorEvent.kt`
- `android/app/src/main/java/com/trackmirror/mobile/SpotifyPlaybackAdapter.kt`

The Kotlin work is now treated as a platform-adapter prototype rather than a separate implementation of Track Mirror's core mirroring rules.

### iOS/iPadOS adapter prototype

- `ios/README.md`
- `ios/TrackMirror/MirrorEvent.swift`
- `ios/TrackMirror/SpotifyPlaybackAdapter.swift`

The Swift work is now treated as a platform-adapter prototype rather than a separate implementation of Track Mirror's core mirroring rules.

## Rust-first cross-platform foundation

Adopted October 23, 2026 after comparing a Tauri/Rust approach with Kotlin/Compose Multiplatform and considering Windows 11, macOS, Android, and iOS/iPadOS together.

The repository owner prefers Rust and directed that Track Mirror use a unified Rust-first foundation while avoiding framework lock-in.

### Cargo workspace

The repository root now contains a Cargo workspace with:

- `crates/track-mirror-core` — framework-independent Rust core;
- `src-tauri` — thin Tauri 2 command/application shell.

The core crate contains no Tauri, Spotify SDK, Kotlin, Swift, WebView, or OS-specific dependency.

### First Rust mirror engine

`crates/track-mirror-core/src/lib.rs`

The initial engine implements:

- protocol-version and exact Spotify track-URI validation;
- selected-listener state;
- armed/disarmed state;
- first-event baseline behavior so arming does not immediately play stale activity;
- exact-URI play decisions on subsequent track changes;
- explicit pause decisions;
- duplicate/out-of-order sequence suppression;
- ignoring events from non-selected listeners;
- unit tests for the proven behaviors above.

### Tauri shell

`src-tauri/`

Tauri is intentionally a replaceable shell around the core. It exposes commands for listener selection, arm/disarm, engine status, and event processing. The initial shared UI in `ui/` is deliberately small and framework-free while the architecture is validated.

Tauri 2 is the initial common application shell for Windows, macOS, Android, and iOS/iPadOS. Native platform code remains appropriate where Spotify or operating-system SDKs require it.

### Architecture record

`docs/RUST_FIRST_ARCHITECTURE.md`

This document defines what belongs in the Rust core and what must remain in platform adapters. The explicit goal is that Track Mirror's durable synchronization/state logic survives even if Tauri is replaced later.

### Continuous integration

`.github/workflows/rust.yml`

GitHub Actions is configured to run `cargo test -p track-mirror-core` for relevant pushes and pull requests. The execution environment available to this ChatGPT session does not itself contain Rust, so repository CI is the authoritative compile/test check for the committed Rust scaffold.

## Key design decisions

1. Mirror metadata/state only; do not transmit Spotify audio.
2. The follower's own Spotify account/client initiates playback.
3. Preserve a clear distinction between the source listener's state and the follower's playback session.
4. Prefer robust client integration over screen-dependent OCR.
5. Do not invent or depend prematurely on undocumented internal APIs; use feature detection and replaceable adapters.
6. Preserve a written development record and decision history.
7. Do not distribute patched Spotify binaries; integrate with the user's own installation separately.
8. Every patching/modification step must have a corresponding rollback path.
9. Keep independent Track Mirror recovery state in addition to Spicetify's own backup/restore mechanism.
10. Prefer using exact track identifiers already present in source state over repeated catalog search.
11. Keep platform-specific discovery/playback adapters separate from portable core mirroring concepts.
12. Android and iOS/iPadOS are first-class targets, with Windows 11 and macOS included in the same architectural planning rather than bolted on later.
13. Do not assume mobile Spotify exposes desktop Listening Activity. Source observation and follower playback must remain separable.
14. Rust is the canonical implementation language for portable Track Mirror state/synchronization logic.
15. Tauri is a replaceable shell; `track-mirror-core` must not depend on it.
16. Native Kotlin/Swift/platform code should implement only the thin capabilities that cannot be shared cleanly through Rust/Tauri.
17. Preserve the proven baseline-on-arm behavior and duplicate suppression in the portable core rather than reimplementing them independently per platform.

## Open technical questions

- Whether the current desktop Listening Activity DOM remains stable across Spotify updates.
- Whether a cleaner desktop internal client API can be discovered without coupling the whole application to unstable internals.
- Fallback behavior when the exact track is unavailable in the follower's market/account.
- Timing, seek-position, pause/resume, and drift-correction behavior beyond the first Rust state machine.
- How to distinguish current activity from stale historical activity robustly.
- Authentication/consent model for following another listener.
- Transport from a source adapter to follower clients.
- Android lifecycle/background behavior once live mirroring transport is added.
- iOS lifecycle/app-switch/background limitations for continuous mirroring.
- Exact Windows and macOS Spotify playback/source adapter mechanisms.
- Whether Tauri mobile plugins alone are sufficient for Spotify App Remote lifecycle handling or whether UniFFI/native shell boundaries will be preferable for some paths.
- Exact health-check and version-gating policy before the desktop installer is suitable for general users.

## Legal / platform review status

Preliminary review only. The project is intentionally designed around metadata/state mirroring rather than audio rebroadcasting. Spotify Terms, Developer Policy, API restrictions, App Remote behavior, Tauri/Rust dependency licenses, platform-store rules, and any Spicetify licensing/compatibility concerns must be re-checked against the implementation actually chosen before public release.

## Canonical repository

`AaronFeldman/track-mirror`

## Next implementation milestone

1. Obtain a green GitHub Actions run for `track-mirror-core` and correct any compile/test issues.
2. Run the minimal Tauri shell on the existing Linux development machine and exercise the shared Rust engine through the development event tester.
3. Fold the Android Spotify App Remote code into a thin Tauri/mobile adapter that consumes `MirrorAction` decisions from the Rust core.
4. Do the equivalent for iOS/iPadOS, preserving Apple's app-switch/lifecycle constraints.
5. Add Windows 11 and macOS playback/source adapters without moving platform-specific code into the Rust core.
