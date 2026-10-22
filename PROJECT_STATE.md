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

## Existing proof of concept

A local Linux script, `~/.local/bin/follow-amanda`, was used to watch Spotify Friend Activity and detect track changes with desktop automation plus OCR. The proof of concept established that the core follow/mirror experience is useful, but OCR is considered transitional rather than the target architecture.

## Current implementation state

A first non-OCR Friend Activity adapter now exists at:

`spicetify/track-mirror-friend-activity.js`

It runs inside Spotify through Spicetify, watches the rendered Friend Activity DOM, extracts friend/track/artist/context links where available, emits `track-mirror:friend-activity` events, and stores the latest observations in local storage. This is a discovery adapter: it deliberately avoids assuming an undocumented stable Spotify Friend Activity endpoint.

Testing can proceed even while no friend is actively listening. An empty observation set is valid; live activity will be used later to refine selectors and confirm the rendered structure in the current Spotify build.

## Key design decisions

1. Mirror metadata/state only; do not transmit Spotify audio.
2. The follower's own Spotify account/client initiates playback.
3. Preserve a clear distinction between the source listener's state and the follower's playback session.
4. Prefer robust client integration over screen-dependent OCR.
5. Do not invent or depend prematurely on undocumented internal APIs; use feature detection and replaceable adapters.
6. Preserve a written development record and decision history.

## Open technical questions

- Whether the current Friend Activity DOM provides stable enough identifiers/links across Spotify updates.
- Whether a cleaner internal client API can be discovered and used without coupling the whole application to unstable internals.
- Fallback behavior when the exact track is unavailable in the follower's market/account.
- Timing, seek-position, pause/resume, and drift-correction behavior.
- Authentication/consent model for following another listener.
- Cross-platform support beyond Linux.

## Legal / platform review status

Preliminary review only. The project is intentionally designed around metadata/state mirroring rather than audio rebroadcasting. Spotify Terms, Developer Policy, API restrictions, and any Spicetify licensing/compatibility concerns must be re-checked against the implementation actually chosen before public release.

## Canonical repository

`AaronFeldman/track-mirror`

## Next implementation milestone

Install the Spicetify discovery adapter in the user's Spotify client, verify that it loads while Friend Activity is idle, and capture the first real friend-activity observation when a friend becomes active. Then connect those observations to Track Mirror's normalized source interface and follower playback logic.
