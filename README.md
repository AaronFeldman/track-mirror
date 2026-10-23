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

## Current status

The Linux desktop prototype is functionally validated in the current Spotify/Spicetify environment.

The current working desktop path is:

1. detect a friend's Spotify Listening Activity without OCR;
2. extract the displayed track and artist;
3. recover the exact embedded Spotify track URI from the client DOM;
4. let the user select which visible friend to mirror;
5. arm mirroring without immediately playing stale activity;
6. on that friend's next track change, play the corresponding URI in the follower's own Spotify client.

The first successful end-to-end live mirroring test was completed on October 22, 2026.

## Rust-first cross-platform foundation

As of October 23, 2026, the next-generation Track Mirror application is being built around a framework-independent Rust core with Tauri 2 as the initial cross-platform shell.

The intended boundary is:

- `crates/track-mirror-core/` — canonical portable mirror-event model and mirroring decision engine; no Tauri, Spotify SDK, WebView, Kotlin, Swift, or operating-system dependency.
- `src-tauri/` — thin Tauri command/application shell.
- `ui/` — shared thin UI.
- `android/`, `ios/`, desktop integrations, and `spicetify/` — platform-specific adapters around the core.

The Tauri shell is deliberately replaceable. If the application framework changes later, the Rust core should remain usable without rewriting Track Mirror's synchronization/state logic. See `docs/RUST_FIRST_ARCHITECTURE.md`.

The first Rust engine already preserves proven desktop semantics: arming establishes a baseline instead of immediately playing stale activity, the next changed exact Spotify track URI becomes a play action, events from other listeners are ignored, and duplicate/out-of-order sequence values do not restart playback.

## Mobile development

Android and iOS/iPadOS remain first-class next-phase targets, now under the shared Rust-first architecture rather than as separate implementations of Track Mirror's product logic.

Spotify's supported mobile App Remote SDKs can control the installed Spotify app and play an exact Spotify URI, but Spotify's public developer interfaces do not currently expose another arbitrary friend's live Listening Activity. Native Kotlin/Swift code therefore remains useful as thin follower/playback adapters while source observation and mirroring policy stay separate.

Existing mobile foundation:

- `docs/MOBILE_ARCHITECTURE.md` — mobile architecture and staged implementation notes.
- `mobile/PROTOCOL.md` — normalized mirror-event format.
- `android/` — Android Spotify adapter experiments.
- `ios/` — iOS/iPadOS Spotify adapter experiments.

## Linux desktop launcher

The proven Linux/Spicetify prototype can be registered as a normal desktop application so routine use does not require pasting terminal commands.

From the repository, run once:

```bash
bash scripts/install-desktop-launcher.sh
```

This installs a per-user application entry named **Track Mirror** under `~/.local/share/applications` and a launcher command under `~/.local/bin`. The normal Spotify installation remains separate.

## Rust development

The repository root is now a Cargo workspace. The framework-independent core can be tested with:

```bash
cargo test -p track-mirror-core
```

GitHub Actions also runs the Rust core tests for relevant pushes and pull requests.

The initial Tauri shell uses static web assets intentionally, avoiding an additional frontend framework until the Rust/core boundaries are proven.

## Repository guide

- `PROJECT_STATE.md` — canonical current project state.
- `docs/DEVELOPMENT_HISTORY.md` — development and authorship/provenance record.
- `docs/RUST_FIRST_ARCHITECTURE.md` — Rust-core / replaceable-shell architecture decision.
- `docs/INSTALL_AND_RECOVERY.md` — installation, rollback, and desktop-launcher behavior.
- `docs/ARCHITECTURE.md` — overall architecture direction.
- `docs/MOBILE_ARCHITECTURE.md` — Android/iOS architecture notes.
- `mobile/PROTOCOL.md` — normalized mirror-event protocol.
- `crates/track-mirror-core/` — portable Rust core.
- `src-tauri/` — Tauri application bridge.
- `ui/` — shared application shell UI.
- `android/` — Android adapter work.
- `ios/` — iOS/iPadOS adapter work.
- `spicetify/` — proven desktop discovery, URI, and playback adapters.

Track Mirror does not distribute Spotify binaries. The user supplies their own Spotify installation and Track Mirror integrates with that installation separately.
