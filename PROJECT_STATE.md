# Track Mirror — Canonical Project State

Last updated: 2026-10-23

## Core concept

Track Mirror is a Spotify companion application that mirrors track identity and playback state between listeners. It does not rebroadcast or proxy Spotify audio. Each listener's own Spotify client performs playback.

## Current product direction

- Follow a selected friend's listening activity closely enough that the follower's own Spotify client can play the corresponding tracks.
- Prefer the term **mirroring** rather than rebroadcasting.
- Move away from OCR/screen scraping where practical.
- Preserve the existing Spicetify implementation as a **working proof of concept and temporary usable Linux version** while the new Linux Rust/Tauri implementation is developed. Spicetify is not the permanent Linux architecture.
- Use the proven Spicetify Listening Activity/URI work as a reference/source adapter where useful without making the replacement Linux product depend permanently on Spicetify.
- Keep implementation compatible with Spotify platform rules and third-party licenses.
- Distribute Track Mirror and its integration logic, not patched Spotify binaries.
- Treat complete rollback/recovery as a core product requirement.
- Keep the architecture portable across Linux, Windows 11, macOS, Android, and iOS/iPadOS.
- Use **Rust as the canonical portable core** for Track Mirror protocol/state/synchronization/mirroring decisions.
- Use **Tauri 2 as an initial replaceable cross-platform shell**, not as the home of product logic.
- Keep Kotlin, Swift, Spicetify/JavaScript, and desktop-native code as thin platform adapters around the Rust core.
- Android and iOS/iPadOS are the current first device-validation targets, while Linux, Windows, and macOS remain first-class architectural targets.
- Across every build, Track Mirror controls must **not permanently obscure Spotify/app content**. Prefer normal app chrome for compact status/control, an on-demand modal/popover/sheet for quick controls, and a dedicated Track Mirror screen/window for expanded configuration and diagnostics.
- Across every build, the normal primary control/app surface must visibly identify itself as **Track Mirror** without requiring hover or a prior click.
- The approved primary-control state cue is **▷ Track Mirror** for mirroring OFF and **⇄ Track Mirror** for mirroring ON, or the closest unambiguous native equivalent where exact glyphs are unsuitable.
- The state glyph/icon and **Track Mirror** label must form one actual clickable/tappable control. The state cue must be visually prominent enough to read as intentional interactive UI; the tested Linux reference uses an approximately 26 px state glyph beside compact control text.
- Across phone, tablet, and desktop builds, ordinary quick-control changes must take effect immediately and the quick-control surface must **dismiss itself after the user's completed action**. An X/close affordance may exist as a fallback but must not be required to finish normal source selection or Mirroring ON/OFF changes.
- Closing or dismissing quick controls must never be treated as turning Track Mirror off; mirroring state changes only through an explicit **Mirroring ON / Mirroring OFF** control.
- The approved Spicetify control shown, tested, corrected, and accepted on October 23, 2026 is the current visual/interaction reference to carry forward across platforms where native conventions permit.

See `docs/PRODUCT_REQUIREMENTS.md` for mandatory cross-platform product requirements and `docs/UI_REFERENCE.md` for the approved visual/interaction reference.

## Existing proof of concept

The earliest local Linux proof of concept used `~/.local/bin/follow-amanda` to watch Spotify Friend Activity with desktop automation plus OCR. That established that the core follow/mirror experience is useful, but OCR is transitional rather than the target architecture.

The later Spicetify implementation became the first working non-OCR end-to-end proof of concept and is currently retained as the temporary usable Linux version while the replacement Linux Rust/Tauri build is developed.

## Validated desktop implementation

The current Spicetify-based non-OCR path is working end to end as the legacy proof of concept.

### Listening Activity discovery

`spicetify/track-mirror-friend-activity.js`

This extension runs inside Spotify through Spicetify, detects the rendered **Listening activity** panel, identifies visible friends, extracts visible track/artist text, emits `track-mirror:friend-activity` events, and stores the latest observations in local storage.

### Exact track-URI discovery

`spicetify/track-mirror-dom-uri-probe.js`

This extension probes only the local DOM around already identified Listening Activity rows and recovers exact embedded Spotify track URIs (`spotify:track:...`). This avoids OCR and avoids repeated Spotify catalog-search requests.

### Playback mirroring

`spicetify/track-mirror-playback.js`

This extension provides a user-controlled friend selector plus mirroring ON/OFF control. Enabling mirroring treats the selected friend's currently displayed URI as a baseline, so Track Mirror does not immediately play potentially stale activity. When that selected friend's URI changes, the extension instructs the follower's own Spotify client to play the newly observed exact URI.

The legacy proof-of-concept controls no longer use a permanent floating overlay. The approved Spicetify top-bar control is one actual clickable element that shows **▷ Track Mirror** when mirroring is OFF and **⇄ Track Mirror** when mirroring is ON. The state glyph is deliberately prominent (approximately 26 px in the tested implementation) while the `Track Mirror` text remains compact and readable. Clicking the control opens a React-backed modal containing friend selection, a large explicit **Mirroring ON / Mirroring OFF** control, and status. Friend selection and ON/OFF changes take effect immediately; completed interactions automatically dismiss the quick-control modal, while simply closing the modal never changes mirroring state. This implementation is the current approved visual/interaction reference for future platform builds.

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
- `plugins/spotify-playback` — thin Tauri/native playback bridge;
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

The replacement Linux build is intended to use this same Rust-core / replaceable-adapter architecture as Windows, macOS, Android, and iOS rather than making the legacy Spicetify proof of concept the permanent Linux architecture.

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

Future shared UI work must follow `docs/PRODUCT_REQUIREMENTS.md` and the approved reference in `docs/UI_REFERENCE.md`, including the stateful **▷ Track Mirror / ⇄ Track Mirror** primary-control meaning (or native equivalent), a single glyph+label click/tap target, visible Track Mirror identity, non-obstructive controls, explicit Mirroring ON/OFF wording, immediate application of changes, and self-dismissal of completed quick-control interactions.

## Build/CI status

GitHub Actions verifies the framework-independent Rust core and performs a Linux `cargo check` of the Tauri/Rust bridge.

The core test is green.

The first bridge compile exposed an upstream compatibility break between `tauri-plugin-deep-link 2.6.2` and newer `rust-ini 0.21.x` `ParseOption` fields. Track Mirror pins Linux resolution to `rust-ini = 0.21.1` as a narrowly documented compatibility workaround while upstream catches up.

Current CI does **not** yet prove that the Kotlin Android project or Swift iOS project compiles against the native Spotify SDKs. Those platform builds remain validation work.

Separate unmerged desktop-native work exists on `desktop-native-playback`; it must not be confused with the legacy Spicetify proof-of-concept update.

## Earlier standalone mobile prototypes

The earlier files under `android/` and `ios/` remain useful as adapter experiments/history, but they are no longer the canonical home of Track Mirror mirroring rules. Their Spotify-specific responsibilities are being folded into `plugins/spotify-playback` so all platforms consume the same Rust decisions.

## Legacy Linux proof of concept, launcher, and rollback

The existing Linux Spicetify implementation remains available for use while the replacement Linux Rust/Tauri application is developed and tested.

Relevant paths include:

- `spicetify/track-mirror-friend-activity.js`
- `spicetify/track-mirror-dom-uri-probe.js`
- `spicetify/track-mirror-playback.js`
- `scripts/track-mirror-launch.sh`
- `scripts/install-desktop-launcher.sh`
- `desktop/track-mirror.desktop.in`
- `scripts/install-track-mirror.sh`
- `scripts/restore-spotify.sh`
- `docs/INSTALL_AND_RECOVERY.md`

The ordinary Spotify installation remains separate. The working proof of concept should not be removed or broken merely because the replacement Linux build is under development. Cutover occurs only after the replacement is functionally reliable and the repository owner approves it.

The proof-of-concept UI is also the current reference implementation for the cross-platform quick-control experience described in `docs/UI_REFERENCE.md`.

## Key design decisions

1. Mirror metadata/state only; do not transmit Spotify audio.
2. The follower's own Spotify account/client initiates playback.
3. Preserve a clear distinction between source-listener state and follower playback session.
4. Prefer robust client integration over screen-dependent OCR.
5. Prefer exact track identifiers already present in source state over repeated catalog search.
6. Keep platform-specific discovery/playback adapters separate from portable mirroring concepts.
7. Rust is the canonical home of portable Track Mirror product logic.
8. Tauri is a replaceable shell/bridge, not a required dependency of `track-mirror-core`.
9. Native platform adapters execute platform calls but do not independently implement mirroring policy.
10. Do not distribute patched Spotify binaries or claim authorship of third-party Spotify SDK binaries.
11. Every local Spotify patch/modification path must retain a rollback path.
12. Preserve a written development/authorship record distinguishing repository-owner design decisions from AI-assisted implementation.
13. Do not assume mobile Spotify exposes desktop Listening Activity; source observation and follower playback remain separable.
14. Track Mirror controls must not permanently cover or obstruct host-application content on any supported platform.
15. The current Spicetify Linux build is a working proof of concept and temporary usable implementation, not the permanent Linux architecture.
16. Keep the legacy proof of concept available until the replacement Linux build is validated and approved for cutover.
17. The primary Track Mirror app/control surface must visibly identify itself as **Track Mirror** without requiring hover or prior interaction.
18. The approved primary state cue is **▷ Track Mirror** for OFF and **⇄ Track Mirror** for ON, or a native equivalent preserving the same meaning; glyph/icon and label must be one clickable/tappable control and the state cue must be visually prominent.
19. Source selection and Mirroring ON/OFF quick actions must apply immediately and should automatically dismiss their transient control surface after completion across phone, tablet, and desktop builds.
20. Closing/dismissing a quick-control surface is never equivalent to disabling Track Mirror; only the explicit Mirroring ON/OFF control changes mirroring state.
21. `docs/UI_REFERENCE.md` is the canonical cross-platform visual/interaction reference, derived from the approved working Spicetify control implementation.

## Open technical questions

- Mobile transport from a source adapter to Android/iOS follower clients.
- Android lifecycle/background behavior once live transport is added.
- iOS app-switch/background limitations for continuous mirroring.
- Real-device behavior of the Tauri/native Spotify bridge.
- Spotify developer-app registration details, including Android signing fingerprint and Apple bundle configuration.
- Timing, seek-position, pause/resume, and drift-correction behavior beyond the first track-change milestone.
- Fallback behavior when the exact track is unavailable in the follower's market/account.
- Authentication/consent model for following another listener.
- New Linux Rust/Tauri source/playback adapter details and migration criteria from the Spicetify proof of concept.
- Windows 11 and macOS source/playback adapters.
- Whether the current desktop Listening Activity DOM remains stable across Spotify updates while the proof of concept remains in use.

## Legal / platform review status

Preliminary review only. The project is intentionally designed around metadata/state mirroring rather than audio rebroadcasting. Spotify Terms, Developer Policy, App Remote restrictions, Apple/Google distribution rules, and third-party licenses must be re-checked against the implementation actually shipped before public release.

## Canonical repository

`AaronFeldman/track-mirror`

## Next implementation milestone

1. Keep the legacy Spicetify proof of concept usable while replacement development continues.
2. Treat the approved stateful **▷ Track Mirror / ⇄ Track Mirror** control, single glyph+label click/tap target, prominent state cue, and self-dismissing quick-control behavior as acceptance criteria for every new platform UI.
3. Obtain/register Track Mirror's Spotify developer application identity and callback configuration without introducing a client secret into the app.
4. Generate/build the Tauri Android project, fetch Spotify Android App Remote through the repository script, and compile the Kotlin plugin.
5. Run the first physical Android-device test: configure Spotify, authorize, arm, baseline one URI, inject a changed second URI, and confirm the follower's Spotify app plays it.
6. Develop the replacement Linux Rust/Tauri path in parallel using the same shared architecture and the approved cross-platform UI requirements.
7. On a Mac/Xcode environment, build the same Tauri/Rust core with the Swift plugin and repeat the equivalent iOS physical-device test.
8. Only after follower playback paths are validated, add the replaceable source-to-follower transport.
