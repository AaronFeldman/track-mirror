# Architecture Notes

## Goal

Track Mirror should mirror a selected source listener's track identity and playback state into a follower's own Spotify client without relaying audio.

## Target flow

1. Observe source-listener state.
2. Normalize the state into a small internal model.
3. Resolve the same Spotify track for the follower.
4. Command the follower's own client to play/pause/seek as appropriate.
5. Periodically reconcile timing drift.

## Internal state model

At minimum:

- source listener identifier
- Spotify track URI/ID when available
- track title
- artist(s)
- album
- playback position
- playing/paused state
- observation timestamp
- source confidence / provenance

## Adapter model

Keep source observation and follower control separate:

- `source adapter` — reads friend/currently-playing state
- `resolver` — maps observed track identity to a Spotify track
- `playback adapter` — controls the follower's Spotify client
- `sync engine` — decides when to play, pause, seek, or ignore small drift

This allows the OCR proof of concept to coexist temporarily with a future Spicetify/direct adapter without changing the rest of the application.

## Candidate integrations

### Source side

Preferred: a permitted local Spotify-client integration capable of exposing Friend Activity or equivalent state.

Candidate: Spicetify extension/plugin if the required state is available in the client.

Fallback: desktop OCR adapter for experimentation only.

### Follower side

Candidate mechanisms include Spotify's supported control interfaces where available, or local client control such as MPRIS on Linux for prototype work. Exact production mechanism remains undecided.

## Non-goals

- Capturing or rebroadcasting Spotify audio.
- Proxying another user's authenticated audio stream.
- Circumventing Spotify DRM or access controls.
- Pretending two clients are one Spotify playback device.

## Cross-platform direction

Start with Linux because the proof of concept already exists there. Keep core state/sync logic platform-neutral so Windows and macOS adapters can be added later.
