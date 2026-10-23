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
- As of October 23, 2026, prioritize native Android and iOS/iPadOS follower development as the next major product phase rather than spending the next phase primarily hardening desktop behavior.

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

### Shared mobile protocol

`mobile/PROTOCOL.md`

Defines a platform-neutral normalized mirror event. The first version carries source-listener identity, exact Spotify track URI, playing state, observation time, optional metadata/timing, sequence, provenance and confidence. It carries metadata/state only, never Spotify audio.

### Mobile architecture

`docs/MOBILE_ARCHITECTURE.md`

Spotify's supported Android and iOS App Remote SDKs can control the Spotify app installed on the follower's device and play an exact Spotify URI. Spotify's public developer interfaces do not currently expose an arbitrary friend's live Listening Activity, so the first native mobile clients are being developed as follower/playback adapters rather than replicas of the desktop source adapter.

### Android foundation

- `android/README.md`
- `android/app/src/main/java/com/trackmirror/mobile/MirrorEvent.kt`
- `android/app/src/main/java/com/trackmirror/mobile/SpotifyPlaybackAdapter.kt`

The initial Android adapter connects to Spotify App Remote, accepts exact Track Mirror URIs, suppresses duplicate delivery of the same track, and delegates playback to the installed Spotify app.

### iOS/iPadOS foundation

- `ios/README.md`
- `ios/TrackMirror/MirrorEvent.swift`
- `ios/TrackMirror/SpotifyPlaybackAdapter.swift`

The initial Swift adapter uses Spotify App Remote, handles the authorization callback, uses the first real mirrored URI to wake/authorize Spotify when needed, suppresses duplicate playback, and delegates playback to the installed Spotify app.

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
12. Android and iOS/iPadOS are now first-class next-phase targets, with the same normalized event model but native Spotify playback adapters.
13. Do not assume mobile Spotify exposes desktop Listening Activity. Source observation and follower playback must remain separable so a desktop-observed source, cooperative source, or future supported source can feed the same mobile clients.

## Open technical questions

- Whether the current desktop Listening Activity DOM remains stable across Spotify updates.
- Whether a cleaner desktop internal client API can be discovered without coupling the whole application to unstable internals.
- Fallback behavior when the exact track is unavailable in the follower's market/account.
- Timing, seek-position, pause/resume, and drift-correction behavior.
- How to distinguish current activity from stale historical activity robustly.
- Authentication/consent model for following another listener.
- Mobile transport from a source adapter to Android/iOS follower clients.
- Android lifecycle/background behavior once live mirroring transport is added.
- iOS lifecycle/app-switch/background limitations for continuous mirroring.
- Exact health-check and version-gating policy before the desktop installer is suitable for general users.

## Legal / platform review status

Preliminary review only. The project is intentionally designed around metadata/state mirroring rather than audio rebroadcasting. Spotify Terms, Developer Policy, API restrictions, App Remote behavior, and any Spicetify licensing/compatibility concerns must be re-checked against the implementation actually chosen before public release.

## Canonical repository

`AaronFeldman/track-mirror`

## Next implementation milestone

Validate native follower playback on Android and iOS/iPadOS: authorize/connect to Spotify App Remote and successfully play a manually injected Track Mirror event containing an exact `spotify:track:...` URI. After both playback adapters are validated, add a replaceable Track Mirror transport that feeds the same normalized events from the existing desktop source adapter to the mobile clients.
