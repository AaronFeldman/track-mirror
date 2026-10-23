# Track Mirror Mobile Event Protocol

Version: 0.1-draft

This protocol carries Track Mirror metadata/state only. It never carries Spotify audio.

## Event

A normalized mirror event is JSON with this initial shape:

```json
{
  "version": 1,
  "source_listener_id": "amanda",
  "track_uri": "spotify:track:0123456789ABCDEFGHIJKL",
  "track_title": "Example Track",
  "artists": ["Example Artist"],
  "album": "Example Album",
  "is_playing": true,
  "position_ms": null,
  "observed_at": "2026-10-23T09:00:00Z",
  "sequence": 42,
  "provenance": "spotify-desktop-listening-activity",
  "confidence": "exact-uri"
}
```

## Required fields for the first mobile playback milestone

- `version`
- `source_listener_id`
- `track_uri`
- `is_playing`
- `observed_at`

The first mobile clients may ignore timing fields that are not yet implemented.

## Track identity

When available, `track_uri` is authoritative. The normal value is an exact Spotify track URI such as `spotify:track:...` recovered by a source adapter.

Track Mirror should not re-search Spotify's catalog when an exact URI is already present.

## Duplicate handling

A follower client should not restart playback merely because it receives the same event more than once. A client should primarily compare `track_uri`, and later may use `sequence`, `is_playing`, `position_ms`, and observation time for richer synchronization.

## Sequence

`sequence` is monotonically increasing within one source-adapter session when available. It is advisory in version 1 and is intended to help detect duplicate or out-of-order transport delivery.

## Time

`observed_at` is an RFC 3339 / ISO 8601 UTC timestamp recording when the source adapter observed the state.

`position_ms` is nullable until source-position observation and drift correction are implemented reliably.

## Provenance

`provenance` identifies how the source state was obtained. Example values may include:

- `spotify-desktop-listening-activity`
- `track-mirror-cooperative-source`
- `manual-test`

`confidence` records how strongly Track Mirror knows the track identity. The current desktop URI discovery path may use `exact-uri`.

## Compatibility rule

Clients must ignore unknown fields. A future protocol version should add fields without forcing old clients to fail whenever possible.
