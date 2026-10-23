# Track Mirror

Track Mirror is a Spotify companion project for mirroring track identity and playback state between listeners without rebroadcasting Spotify audio. Each listener's own Spotify client performs playback.

## Project principles

- Mirror metadata and playback state, not audio streams.
- Prefer direct client/integration approaches over screen scraping or OCR where feasible.
- Treat OCR as an early proof-of-concept path, not the long-term architecture.
- Keep Spotify platform rules, licensing, and third-party component licenses under active review.
- Preserve a clear development record of product decisions, experiments, and implementation changes.
- Keep platform-specific integrations replaceable so the core design can support Linux, Windows, macOS, Android, and iOS/iPadOS.
- Keep the durable Track Mirror decision logic in framework-independent Rust; treat Tauri and native mobile/desktop integrations as replaceable shells/adapters.
- Use `PROJECT_STATE.md` plus `DEVELOPMENT_TRANSCRIPT.md` as the canonical recovery pair across devices, chats, resets, and development handoffs.

## Development recovery and chat handoff

Track Mirror uses a CLC-style recovery workflow so development does not depend on any single ChatGPT window.

Before continuing development after a device change, new chat, page reset, or handoff:

1. Read `PROJECT_STATE.md` for the concise canonical current state.
2. Read `DEVELOPMENT_TRANSCRIPT.md` for the chronological human-readable development record.
3. Inspect the active Git branch and any open pull request before changing code.

When possible, open the same ChatGPT conversation on desktop and phone rather than creating parallel development threads. Already-separate chat threads cannot be literally merged or live-synchronized, so GitHub is the authoritative handoff mechanism between them.

## Current status

The Linux desktop prototype is functionally validated in the current Spotify/Spicetify environment.

The working desktop path detects a selected friend's Spotify Listening Activity without OCR, recovers the exact embedded `spotify:track:` URI, baselines the currently displayed track when mirroring is armed, and tells the follower's own Spotify client to play the next changed URI. The first successful live end-to-end mirroring test was completed on October 22, 2026.

## Rust-first cross-platform foundation

As of October 23, 2026, the next-generation Track Mirror application is being built around a framework-independent Rust core with Tauri 2 as the initial cross-platform shell.

The current boundary is:

- `crates/track-mirror-core/` — canonical portable mirror-event model and mirroring decision engine; no Tauri, Spotify SDK, WebView, Kotlin, Swift, or operating-system dependency.
- `plugins/spotify-playback/` — thin Tauri mobile bridge to native Spotify App Remote code.
- `src-tauri/` — thin Tauri command/application shell and action dispatcher.
- `ui/` — shared thin UI.
- `spicetify/` and future desktop integrations — platform-specific source/playback adapters around the core.

The Tauri shell is deliberately replaceable. If the application framework changes later, the Rust core should remain usable without rewriting Track Mirror's synchronization/state logic. See `docs/RUST_FIRST_ARCHITECTURE.md`.

The Rust engine preserves the proven desktop semantics: arming establishes a baseline instead of immediately playing stale activity, the next changed exact Spotify track URI becomes a play action, events from other listeners are ignored, and duplicate/out-of-order sequence values do not restart playback.

## Android and iOS/iPadOS bridge

Android and iOS/iPadOS now share the same Rust mirroring decisions rather than implementing Track Mirror separately.

The current mobile execution path is:

```text
MirrorEvent
  -> Rust MirrorEngine
  -> MirrorAction
  -> Tauri Rust plugin
  -> Kotlin or Swift
  -> follower's Spotify app
```

Only actionable `PlayTrack` and `Pause` decisions cross into native code. `Ignored` and `Baseline` remain inside Rust and do not call Spotify.

Android uses Spotify Android App Remote. The official Spotify AAR is not committed into the Track Mirror repository; `scripts/fetch-spotify-android-app-remote.sh` retrieves it into an ignored local path for Android builds.

iOS/iPadOS uses Spotify iOS App Remote and the `trackmirror://spotify-callback` authorization return scheme. The Swift adapter handles Spotify's app-switch/authorization mechanics while the Rust core remains platform-neutral.

The native mobile code is implemented but **not yet real-device validated**. Current GitHub Actions tests the Rust core and compile-checks the Rust/Tauri bridge on Linux; Android Kotlin and iOS Swift compilation/device playback are the next validation milestones.

## Linux desktop launcher

The proven Linux/Spicetify prototype can be registered as a normal desktop application so routine use does not require pasting terminal commands.

From the repository, run once:

```bash
bash scripts/install-desktop-launcher.sh
```

This installs a per-user application entry named **Track Mirror** under `~/.local/share/applications` and a launcher command under `~/.local/bin`. The normal Spotify installation remains separate.

## Rust development

The repository root is a Cargo workspace. The framework-independent core can be tested with:

```bash
cargo test -p track-mirror-core
```

The Tauri/Rust bridge can be compile-checked with:

```bash
cargo check -p track-mirror-app
```

GitHub Actions runs these checks for relevant pushes and pull requests. The initial Tauri shell uses static web assets intentionally, avoiding an additional frontend framework until the Rust/core boundaries are proven.

## Repository guide

- `PROJECT_STATE.md` — canonical current project state.
- `DEVELOPMENT_TRANSCRIPT.md` — canonical append-only human-readable development transcript and cross-chat/device handoff record.
- `docs/DEVELOPMENT_HISTORY.md` — development and authorship/provenance record.
- `docs/RUST_FIRST_ARCHITECTURE.md` — Rust-core / replaceable-shell architecture decision and adapter boundary.
- `docs/INSTALL_AND_RECOVERY.md` — installation, rollback, and desktop-launcher behavior.
- `docs/ARCHITECTURE.md` — earlier overall architecture direction.
- `docs/MOBILE_ARCHITECTURE.md` — Android/iOS architecture notes.
- `mobile/PROTOCOL.md` — normalized mirror-event protocol.
- `crates/track-mirror-core/` — portable Rust core.
- `plugins/spotify-playback/` — shared Rust/native mobile playback bridge.
- `src-tauri/` — Tauri application bridge.
- `ui/` — shared application shell UI.
- `android/`, `ios/` — earlier adapter experiments/history.
- `spicetify/` — proven desktop discovery, URI, and playback adapters.

Track Mirror does not distribute Spotify binaries. The user supplies their own Spotify installation and Track Mirror integrates with that installation separately. Third-party Spotify SDK binaries and frameworks retain their own provenance and licensing.
