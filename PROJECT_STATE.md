# Track Mirror — Canonical Project State

Last updated: 2026-10-22

## Core concept

Track Mirror is a Spotify companion application that mirrors track identity and playback state between listeners. It does not rebroadcast or proxy Spotify audio. Each listener's own Spotify client performs playback.

## Current product direction

- Follow a selected friend's listening activity closely enough that the follower's own Spotify client can play the corresponding tracks.
- Prefer the term **mirroring** rather than rebroadcasting.
- Move away from OCR/screen scraping where practical.
- Use a Spicetify extension as the current discovery/integration path for Spotify desktop Listening Activity.
- Keep implementation compatible with Spotify platform rules and third-party licenses.
- Distribute Track Mirror and its patching/integration logic, not patched Spotify binaries.
- Treat complete rollback/recovery as a core product requirement.
- Keep the core architecture portable across Linux, Windows 11, macOS, Android, and Apple mobile platforms; treat the current Linux/Spicetify implementation as a platform-specific adapter/test bed.

## Existing proof of concept

A local Linux script, `~/.local/bin/follow-amanda`, was used to watch Spotify Friend Activity and detect track changes with desktop automation plus OCR. The proof of concept established that the core follow/mirror experience is useful, but OCR is considered transitional rather than the target architecture.

## Current implementation state

The current non-OCR desktop path is working end to end.

### Listening Activity discovery

`spicetify/track-mirror-friend-activity.js`

This extension runs inside Spotify through Spicetify, detects the rendered **Listening activity** panel, identifies visible friends, extracts visible track/artist text, emits `track-mirror:friend-activity` events, and stores the latest observations in local storage.

### Exact track-URI discovery

`spicetify/track-mirror-dom-uri-probe.js`

This extension probes only the local DOM around already identified Listening Activity rows and recovers exact embedded Spotify track URIs (`spotify:track:...`). This avoids OCR and avoids repeated Spotify catalog-search requests.

### Playback mirroring

`spicetify/track-mirror-playback.js`

This extension provides a user-controlled `Mirror Amanda` ON/OFF control and uses the exact discovered Spotify URI to instruct the follower's own Spotify client to play a newly detected track. It is armed manually and treats the currently displayed URI as a baseline so enabling mirroring does not immediately play a potentially stale activity entry.

### First successful live end-to-end test

On October 22, 2026, the repository owner confirmed the first successful live mirroring event:

1. Amanda's Listening Activity changed to a new track.
2. Track Mirror detected the changed activity row.
3. Track Mirror recovered the exact embedded Spotify track URI from the local client DOM.
4. The armed playback layer detected the URI change.
5. The user's own Spotify client switched to the mirrored track successfully.

This validated the core product behavior without copying, proxying, or rebroadcasting audio.

A Spotify catalog-search resolver was also explored but encountered HTTP 429 rate-limit responses. The successful current path therefore prefers direct embedded track-URI discovery from the local client DOM and does not require catalog search for normal mirroring.

### Installer and rollback

A safety-focused installer/rollback layer exists:

- `scripts/install-track-mirror.sh`
- `scripts/restore-spotify.sh`
- `docs/INSTALL_AND_RECOVERY.md`

The installer performs preflight checks, records a timestamped Track Mirror recovery snapshot, invokes Spicetify's vanilla backup, installs/enables the Track Mirror extension, and attempts automatic restoration if `spicetify apply` fails. The restore script invokes `spicetify restore`, removes or restores the pre-existing Track Mirror extension file, restores the saved Spicetify configuration when available, and leaves recovery snapshots in place for manual disaster recovery.

## Key design decisions

1. Mirror metadata/state only; do not transmit Spotify audio.
2. The follower's own Spotify account/client initiates playback.
3. Preserve a clear distinction between the source listener's state and the follower's playback session.
4. Prefer robust client integration over screen-dependent OCR.
5. Do not invent or depend prematurely on undocumented internal APIs; use feature detection and replaceable adapters.
6. Preserve a written development record and decision history.
7. Do not distribute patched Spotify binaries; patch the user's own installation locally.
8. Every patching/modification step must have a corresponding rollback path.
9. Keep independent Track Mirror recovery state in addition to Spicetify's own backup/restore mechanism.
10. Prefer using exact track identifiers already present in the local Spotify client state over repeated catalog search.
11. Keep platform-specific discovery/playback adapters separate from portable core mirroring concepts.

## Open technical questions

- Whether the current Listening Activity DOM remains stable across Spotify updates.
- Whether a cleaner internal client API can be discovered and used without coupling the whole application to unstable internals.
- Fallback behavior when the exact track is unavailable in the follower's market/account.
- Timing, seek-position, pause/resume, and drift-correction behavior.
- How to distinguish current activity from stale historical activity robustly.
- User-selectable target friend UI rather than a hard-coded Amanda target.
- Authentication/consent model for following another listener.
- Cross-platform implementation paths beyond Linux desktop.
- Exact health-check and version-gating policy before the installer is suitable for general users.

## Legal / platform review status

Preliminary review only. The project is intentionally designed around metadata/state mirroring rather than audio rebroadcasting. Spotify Terms, Developer Policy, API restrictions, and any Spicetify licensing/compatibility concerns must be re-checked against the implementation actually chosen before public release.

## Canonical repository

`AaronFeldman/track-mirror`

## Next implementation milestone

Replace the hard-coded Amanda target with a generic selectable-friend control while preserving the successful URI-based mirroring path. Then harden stale-activity detection, startup behavior, event/debounce logic, and version compatibility before broadening to Windows/macOS and exploring mobile adapters.
