# Track Mirror — Canonical Project State

Last updated: 2026-10-23

## Core concept

Track Mirror is a Spotify companion application that mirrors track identity and playback state between listeners. It does not rebroadcast or proxy Spotify audio. Each listener's own Spotify client performs playback.

## Current product direction

- Follow a selected friend's listening activity closely enough that the follower's own Spotify client can play the corresponding tracks.
- Prefer the term **mirroring** rather than rebroadcasting.
- Move away from OCR/screen scraping where practical.
- Use the existing Spicetify integration as the proven desktop Listening Activity source/reference adapter.
- Keep implementation compatible with Spotify platform rules and third-party licenses.
- Distribute Track Mirror and its integration logic, not patched Spotify binaries.
- Treat complete rollback/recovery as a core product requirement.
- Keep the architecture portable across Linux, Windows 11, macOS, Android, and iOS/iPadOS.
- Use **Rust as the canonical portable core** for Track Mirror protocol/state/synchronization/mirroring decisions.
- Use **Tauri 2 as an initial replaceable cross-platform shell**, not as the home of product logic.
- Keep Kotlin, Swift, Spicetify/JavaScript, and future Windows/macOS code as thin platform adapters around the Rust core.
- Android and iOS/iPadOS are the current first device-validation targets, while Windows and macOS remain first-class architectural targets.

## Existing proof of concept

A local Linux script, `~/.local/bin/follow-amanda`, was used to watch Spotify Friend Activity and detect track changes with desktop automation plus OCR. The proof of concept established that the core follow/mirror experience is useful, but OCR is transitional rather than the target architecture.

## Validated desktop implementation

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

A Spotify catalog-search resolver was also explored but encountered HTTP 429 rate-limit responses. The successful current path therefore prefers exact track identifiers already present in source/client state rather than catalog search.

## Rust-first shared core

The canonical portable implementation now begins with a Cargo workspace containing:

- `crates/track-mirror-core` — framework-independent Rust state and decision engine;
- `plugins/spotify-playback` — thin Tauri mobile bridge to native Spotify App Remote adapters;
- `src-tauri` — thin cross-platform application shell/command bridge;
- `ui` — deliberately small shared UI used to exercise the Rust engine and adapters.

`track-mirror-core` currently owns:

- protocol version and normalized `MirrorEvent` validation;
- selected-listener state;
- armed/disarmed state;
- baseline-on-arm behavior;
- duplicate and out-of-order suppression;
- listener filtering;
- explicit `MirrorAction` decisions for ignore/baseline/play/pause.

The first Rust core test suite has passed in GitHub Actions.

## Rust-to-native mobile playback bridge

The current mobile bridge flow is:

```text
MirrorEvent
  -> Rust MirrorEngine
  -> MirrorAction
  -> Tauri Rust plugin boundary
  -> Kotlin (Android) or Swift (iOS)
  -> follower's Spotify app
```

Only actionable Rust decisions cross the native boundary:

- `Ignored` — no native Spotify call;
- `Baseline` — no native Spotify call;
- `PlayTrack { track_uri }` — native adapter plays the exact Spotify track URI;
- `Pause` — native adapter pauses Spotify.

The native adapters do not implement Track Mirror's baseline, duplicate-suppression, source-selection, or ordering rules. Those remain centralized in Rust.

### Android plugin

Primary files:

- `plugins/spotify-playback/android/src/main/java/com/trackmirror/spotify/SpotifyPlaybackPlugin.kt`
- `plugins/spotify-playback/android/build.gradle.kts`
- `scripts/fetch-spotify-android-app-remote.sh`

The Android plugin uses Spotify Android App Remote 0.8.0, connects/authorizes when necessary, validates exact `spotify:track:` URIs, and translates Rust play/pause requests into Spotify App Remote commands.

Spotify's AAR is **not committed** into Track Mirror. The fetch script downloads the official third-party binary into `plugins/spotify-playback/android/libs/`, and `.gitignore` excludes `*.aar` there.

### iOS/iPadOS plugin

Primary files:

- `plugins/spotify-playback/ios/Package.swift`
- `plugins/spotify-playback/ios/Sources/SpotifyPlaybackPlugin.swift`

The Swift adapter uses Spotify iOS App Remote (currently pinned in the package to 5.0.1). When Spotify is already connected, it sends the exact URI through the player API. When Spotify must be awakened/authorized, it uses Spotify's authorization/play mechanism for the same exact mirrored URI and waits for the return callback rather than issuing a duplicate play.

Track Mirror registers the custom callback scheme:

`trackmirror://spotify-callback`

The Tauri deep-link layer routes that callback to the Swift Spotify adapter. The Rust core has no knowledge of Apple application-switch mechanics.

### Shared development UI

The shared `ui/` now supports:

- Spotify client-ID configuration for mobile development;
- the fixed Track Mirror redirect URI;
- connect/disconnect;
- listener selection;
- arm/disarm;
- manually injecting a normalized mirror event through `process_and_apply_mirror_event`.

This allows the intended device test to prove the complete path: first event establishes a baseline; a changed second URI produces `MirrorAction::PlayTrack`; the native adapter asks the follower's own Spotify app to play it.

## Build/CI status

GitHub Actions verifies the framework-independent Rust core and performs a Linux `cargo check` of the Tauri/Rust bridge.

The core test is green.

The first bridge compile exposed an upstream compatibility break between `tauri-plugin-deep-link 2.6.2` and newer `rust-ini 0.21.x` `ParseOption` fields. Track Mirror now pins Linux resolution to `rust-ini = 0.21.1` as a narrowly documented compatibility workaround while upstream catches up. A fresh CI run is validating that fix.

Current CI does **not** yet prove that the Kotlin Android project or Swift iOS project compiles against the native Spotify SDKs. Those platform builds remain the next validation step.

## Earlier standalone mobile prototypes

The earlier files under `android/` and `ios/` remain useful as adapter experiments/history, but they are no longer the canonical home of Track Mirror mirroring rules. Their Spotify-specific responsibilities are being folded into `plugins/spotify-playback` so all platforms consume the same Rust decisions.

## Desktop launcher and rollback

The existing Linux desktop launcher and safety-focused Spicetify install/rollback layer remain available:

- `scripts/track-mirror-launch.sh`
- `scripts/install-desktop-launcher.sh`
- `desktop/track-mirror.desktop.in`
- `scripts/install-track-mirror.sh`
- `scripts/restore-spotify.sh`
- `docs/INSTALL_AND_RECOVERY.md`

The ordinary Spotify installation remains separate.

## Key design decisions

1. Mirror metadata/state only; do not transmit Spotify audio.
2. The follower's own Spotify account/client initiates playback.
3. Preserve a clear distinction between source-listener state and follower playback session.
4. Prefer robust client integration over screen-dependent OCR.
5. Prefer exact track identifiers already present in source state over repeated catalog search.
6. Keep platform-specific discovery/playback adapters separate from portable mirroring concepts.
7. Rust is the canonical home of portable Track Mirror product logic.
8. Tauri is a replaceable shell/bridge, not a required dependency of `track-mirror-core`.
9. Native Kotlin/Swift adapters execute platform calls but do not independently implement mirroring policy.
10. Do not distribute patched Spotify binaries or claim authorship of third-party Spotify SDK binaries.
11. Every local Spotify patch/modification path must retain a rollback path.
12. Preserve a written development/authorship record distinguishing repository-owner design decisions from AI-assisted implementation.
13. Do not assume mobile Spotify exposes desktop Listening Activity; source observation and follower playback remain separable.

## Open technical questions

- Mobile transport from a source adapter to Android/iOS follower clients.
- Android lifecycle/background behavior once live transport is added.
- iOS app-switch/background limitations for continuous mirroring.
- Real-device behavior of the Tauri/native Spotify bridge.
- Spotify developer-app registration details, including Android signing fingerprint and Apple bundle configuration.
- Timing, seek-position, pause/resume, and drift-correction behavior beyond the first track-change milestone.
- Fallback behavior when the exact track is unavailable in the follower's market/account.
- Authentication/consent model for following another listener.
- Windows 11 and macOS source/playback adapters.
- Whether the current desktop Listening Activity DOM remains stable across Spotify updates.

## Legal / platform review status

Preliminary review only. The project is intentionally designed around metadata/state mirroring rather than audio rebroadcasting. Spotify Terms, Developer Policy, App Remote restrictions, Apple/Google distribution rules, and third-party licenses must be re-checked against the implementation actually shipped before public release.

## Canonical repository

`AaronFeldman/track-mirror`

## Next implementation milestone

1. Obtain/register Track Mirror's Spotify developer application identity and callback configuration without introducing a client secret into the app.
2. Generate/build the Tauri Android project, fetch Spotify Android App Remote through the repository script, and compile the Kotlin plugin.
3. Run the first physical Android-device test: configure Spotify, authorize, arm, baseline one URI, inject a changed second URI, and confirm the follower's Spotify app plays it.
4. On a Mac/Xcode environment, build the same Tauri/Rust core with the Swift plugin and repeat the equivalent iOS physical-device test.
5. Only after both follower playback paths are validated, add the replaceable source-to-follower transport.

## Development freeze and preservation point — October 23, 2026

At the repository owner's explicit instruction, Track Mirror development is stopped at this point. No further implementation, fixes, merges, test reruns, or repository changes should be made unless the repository owner later gives a new explicit instruction to resume development.

### Preserved desktop work

The desktop implementation work is preserved on branch `desktop-native-playback` in open, unmerged pull request **#1, “Add native desktop Spotify playback adapters.”** The implementation/CI head immediately before this preservation record was commit `33d3b3631bc3b0b56ac28850118e4c46dc2c2f42` (`Compile-check Windows and macOS desktop adapters`). The branch was created from `main` at `f2463afc2c4e9fcdeeecd15c782ae286bbfb79ca`.

The preserved implementation commits made during this development session are:

- `30b1ae51d569837cd88a9b8629d78cd44c2cf8fd` — added the desktop playback command error path;
- `2d696840712b427c805055916be26dc145edd503` — implemented the native/local desktop Spotify playback adapter;
- `d82458e2960154af1252db380e096d7dc7d40090` — routed Rust `MirrorAction` playback decisions through the desktop adapter as well as mobile;
- `33d3b3631bc3b0b56ac28850118e4c46dc2c2f42` — added Windows and macOS CI compile-check jobs.

The desktop adapter preserved on that branch currently does the following:

- validates that playback targets are exact `spotify:track:` URIs;
- on **macOS**, uses `osascript` to tell the locally installed Spotify application to play the exact track URI, and uses AppleScript to pause Spotify;
- on **Windows**, uses `cmd /C start` with the exact Spotify track URI so the installed Spotify client handles playback;
- on **Linux**, uses `xdg-open` with the exact Spotify track URI;
- returns an explicit not-yet-implemented response for pause on Windows and Linux rather than reporting false success;
- keeps baseline-on-arm, selected-listener filtering, duplicate/out-of-order suppression, and mirroring decisions in the shared Rust core rather than duplicating them in the desktop adapters;
- changes `process_and_apply_mirror_event` so actionable `PlayTrack` and `Pause` decisions are dispatched through `spotify-playback` on desktop as well as mobile;
- keeps the mobile-only `trackmirror://` redirect-URI validation scoped to mobile.

No claim is made that the Windows or macOS desktop path is build-validated or device-validated at this freeze point.

### CI/test status at the freeze point

The latest observed pull-request workflow was GitHub Actions run `39951348910` for branch head `33d3b3631bc3b0b56ac28850118e4c46dc2c2f42`.

At the moment development was frozen:

- `core-test`: **passed**;
- `desktop-platform-check (windows-latest)`: **failed before desktop adapter validation**, because Tauri's build step required `src-tauri/icons/icon.ico`, which is not present;
- `desktop-platform-check (macos-latest)`: **failed before desktop adapter validation**, because `tauri::generate_context!()` required `src-tauri/icons/icon.png`, which is not present; the macOS job also emitted an unused-import warning for `tauri_plugin_deep_link::DeepLinkExt` on that target;
- Linux `tauri-check`: **still in progress** at the freeze point, in the prerequisite-install stage, so no final result was recorded here;
- Android Kotlin/Spotify App Remote compilation and real-device validation remain unperformed;
- iOS Swift/Spotify App Remote compilation and physical-device validation remain unperformed.

The Windows/macOS CI failures therefore establish missing Tauri packaging assets, not a successful or unsuccessful compile verdict on the new desktop adapter code itself. No fix was attempted because the repository owner ordered development to stop.

### Resume point

If development is later resumed, begin from this preservation record and the open `desktop-native-playback` branch/PR rather than reconstructing the work from memory. The first unresolved items are the missing Tauri desktop icon assets and completion of the platform compile checks; these are recorded only as resume context, not as authorization to continue now.
