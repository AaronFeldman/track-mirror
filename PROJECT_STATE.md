# Track Mirror — Canonical Project State

Last updated: 2026-10-22

## Core concept

Track Mirror is a Spotify companion application that mirrors track identity and playback state between listeners. It does not rebroadcast or proxy Spotify audio. Each listener's own Spotify client performs playback.

## Current product direction

- Follow a selected friend's listening activity closely enough that the follower's own Spotify client can play the corresponding tracks.
- Prefer the term **mirroring** rather than rebroadcasting.
- Move away from OCR/screen scraping where practical.
- Use a Spicetify extension as the current discovery/integration path for Spotify desktop Friend Activity.
- Keep implementation compatible with Spotify platform rules and third-party licenses.
- Distribute Track Mirror and its patching/integration logic, not patched Spotify binaries.
- Treat complete rollback/recovery as a core product requirement.

## Existing proof of concept

A local Linux script, `~/.local/bin/follow-amanda`, was used to watch Spotify Friend Activity and detect track changes with desktop automation plus OCR. The proof of concept established that the core follow/mirror experience is useful, but OCR is considered transitional rather than the target architecture.

## Current implementation state

A first non-OCR Friend Activity adapter exists at:

`spicetify/track-mirror-friend-activity.js`

It runs inside Spotify through Spicetify, watches the rendered Friend Activity DOM, extracts friend/track/artist/context links where available, emits `track-mirror:friend-activity` events, and stores the latest observations in local storage. This is a discovery adapter: it deliberately avoids assuming an undocumented stable Spotify Friend Activity endpoint.

Testing can proceed even while no friend is actively listening. An empty observation set is valid; live activity will be used later to refine selectors and confirm the rendered structure in the current Spotify build.

A first safety-focused installer/rollback layer also exists:

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

## Open technical questions

- Whether the current Friend Activity DOM provides stable enough identifiers/links across Spotify updates.
- Whether a cleaner internal client API can be discovered and used without coupling the whole application to unstable internals.
- Fallback behavior when the exact track is unavailable in the follower's market/account.
- Timing, seek-position, pause/resume, and drift-correction behavior.
- Authentication/consent model for following another listener.
- Cross-platform support beyond Linux.
- Exact health-check and version-gating policy before the installer is suitable for general users.

## Legal / platform review status

Preliminary review only. The project is intentionally designed around metadata/state mirroring rather than audio rebroadcasting. Spotify Terms, Developer Policy, API restrictions, and any Spicetify licensing/compatibility concerns must be re-checked against the implementation actually chosen before public release.

## Canonical repository

`AaronFeldman/track-mirror`

## Next implementation milestone

Set up the user's parallel patchable Spotify + Spicetify installation while leaving the Snap Spotify untouched. Run the installer in that isolated environment, verify backup/restore behavior before relying on the patch, confirm the Friend Activity adapter loads while activity is idle, and later capture the first live friend-activity observation. Before general distribution, add dry-run, process detection, checksums, version gates, a post-install health check with automatic rollback, and automated recovery tests.
