# Track Mirror — Canonical Project State

Last updated: 2026-10-22

## Core concept

Track Mirror is a Spotify companion application that mirrors track identity and playback state between listeners. It does not rebroadcast or proxy Spotify audio. Each listener's own Spotify client performs playback.

## Current product direction

- Follow a selected friend's listening activity closely enough that the follower's own Spotify client can play the corresponding tracks.
- Prefer the term **mirroring** rather than rebroadcasting.
- Move away from OCR/screen scraping where practical.
- Investigate Spicetify or another permitted local-client integration path for direct playback-state access.
- Keep implementation compatible with Spotify platform rules and third-party licenses.

## Existing proof of concept

A local Linux script, `~/.local/bin/follow-amanda`, was used to watch Spotify Friend Activity and detect track changes with desktop automation plus OCR. The proof of concept established that the core follow/mirror experience is useful, but OCR is considered transitional rather than the target architecture.

## Key design decisions

1. Mirror metadata/state only; do not transmit Spotify audio.
2. The follower's own Spotify account/client initiates playback.
3. Preserve a clear distinction between the source listener's state and the follower's playback session.
4. Prefer robust client integration over screen-dependent OCR.
5. Preserve a written development record and decision history.

## Open technical questions

- Best direct source of Friend Activity / currently-playing data available to a local client.
- Whether Spicetify can expose the necessary friend-activity state reliably.
- Fallback behavior when the exact track is unavailable in the follower's market/account.
- Timing, seek-position, pause/resume, and drift-correction behavior.
- Authentication/consent model for following another listener.
- Cross-platform support beyond Linux.

## Legal / platform review status

Preliminary review only. The project is intentionally designed around metadata/state mirroring rather than audio rebroadcasting. Spotify Terms, Developer Policy, API restrictions, and any Spicetify licensing/compatibility concerns must be re-checked against the implementation actually chosen before public release.

## Canonical repository

`AaronFeldman/track-mirror`

## Next implementation milestone

Build a non-OCR local prototype that can read a friend's currently-playing state from the Spotify desktop client or an allowed companion integration and trigger matching playback in the follower's own client.
