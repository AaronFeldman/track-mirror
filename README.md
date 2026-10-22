# Track Mirror

Track Mirror is a Spotify companion project for mirroring track identity and playback state between listeners without rebroadcasting Spotify audio. Each listener's own Spotify client performs playback.

## Project principles

- Mirror metadata and playback state, not audio streams.
- Prefer direct client/integration approaches over screen scraping or OCR where feasible.
- Treat OCR as an early proof-of-concept path, not the long-term architecture.
- Keep Spotify platform rules, licensing, and third-party component licenses under active review.
- Preserve a clear development record of product decisions, experiments, and implementation changes.

## Current direction

The current technical direction is to investigate a more reliable client-side integration path, including Spicetify or another permitted local-client mechanism, while keeping Spotify playback on the listener's own account/device.

## Status

Early development / architecture phase.

See `PROJECT_STATE.md` for the canonical project state and `docs/DEVELOPMENT_HISTORY.md` for the development record.
