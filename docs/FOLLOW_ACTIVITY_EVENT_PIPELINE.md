# Cloud-first Following activity → portable event pipeline

Status: implementation on separate branch; **cloud simulation is not a live Spotify/device validation**.

## User decision

The source listener has enabled Spotify Listening Activity and chosen to share it with their followers. Track Mirror observes only information already visible to the follower through their own Spotify client; it does not add a redundant Track Mirror consent dialog.

Spotify's controls may hide or revoke that visibility, including private session or per-follower restrictions. Source adapters must not circumvent such visibility controls. This design does **not** infer from Spotify's Follow setting that private APIs or code redistribution are authorized. Developer-policy restrictions, particularly on synchronized multi-listener playback and commercial use, require independent review before release.

## Four concrete goals

| Goal | Implemented cloud-first result | Boundary |
| --- | --- | --- |
| 1. Use a permitted, visible activity source | The existing non-OCR Spicetify DOM URI probe remains the canonical source. The already-installed remote bridge publishes the **selected** friend's exact, visibly displayed track URI. No additional Spotify API or OAuth request. | No mobile source extraction or live friend-API subscription is claimed. |
| 2. Make source metadata portable | `track_mirror_core::source::normalize_visible_activity` converts a source observation to the **existing** `MirrorEvent`; no new cross-platform protocol. Reject malformed IDs, ignore episodes, do not fabricate a pause/position. | Only the source-observer's displayed-listening state is known; UI activity may be delayed. |
| 3. Serve Android/phone clients through desktop host | The desktop remote server accepts `POST /api/event` from localhost Spotify bridge only, exposes `GET /api/event?after=N` to a paired remote client, and clears events when stopping/changing the selected friend. Observations expire after 90 seconds. The existing phone web remote now shows the selected friend's latest fresh track URI as a read-only diagnostic, without triggering Spotify playback. | A metadata transport endpoint is not yet a full native Android receiver/player integration. |
| 4. Test and retain all work | Rust engine unit tests, Python HTTP tests, JS simulated Spicetify tests run in GitHub Actions. Source and state records are committed; third-party decompiled classes remain **only in private encrypted research archives**, with matching fingerprints and decryption key. | Real Spotify and Android device validation still must occur with the user's devices. |

## Transport contract (version 1)

Only the already-followed and currently selected friend is published. Example (synthetic identifiers):

```json
{
  "version": 1,
  "source_listener_id": "sample-listener",
  "track_uri": "spotify:track:0123456789ABCDEFGHIJKL",
  "is_playing": true,
  "observed_at": "2026-11-19T20:00:00Z",
  "provenance": "spotify-client-visible-following"
}
```

`is_playing: true` here means **the client is displaying a listening-activity item**, not proven real-time playback. The bridge does not send a false/pause event when a row disappears.

The server validates the payload, adds a monotonic `sequence`, and responds to a local source POST with:

```json
{ "ok": true, "sequence": 1 }
```

A paired remote may request `GET /api/event?after=0` and receive:

```json
{
  "sequence": 1,
  "event": {
    "version": 1,
    "source_listener_id": "sample-listener",
    "track_uri": "spotify:track:0123456789ABCDEFGHIJKL",
    "is_playing": true,
    "observed_at": "2026-11-19T20:00:00Z",
    "position_ms": null,
    "track_title": null,
    "artists": [],
    "album": null,
    "provenance": "spotify-client-visible-following",
    "confidence": "exact-track-uri-visible-activity",
    "sequence": 1
  }
}
```

If no newer observation exists, the selected target was changed or stopped, or the event has expired, the response contains `"event": null`. The existing `/api/state`, `/api/command`, `/api/follow`, and `/api/stop` semantics are preserved.

The desktop's extension-to-server channel is loopback-only; pairing is required to read from a non-loopback phone. The transport carries no audio, OAuth tokens, album art, or history, and events remain only in RAM; no listener activity is written to the server filesystem.

## Test and deployment

Cloud unit, HTTP, mocked client, and remote HTML syntax tests:

```sh
cargo test -p track-mirror-core
python3 -m unittest discover -s tests -p 'test_remote_event_pipeline.py' -v
node tests/test_spicetify_visible_event_bridge.cjs
# GitHub Actions also extracts the phone remote's inline script and checks it with Node.
```

When the desktop is accessible again, install the changed Spicetify extension and server using the repo's existing installer and launcher workflow. Nothing in this research branch automatically updates or restarts a running Spotify process. Confirm locally that (a) a visible selected listener produces events, (b) hiding that listener removes their new events and old activity expires, (c) switching targets clears the cached old track, and (d) stop disables further events. Use a Tailscale-private host connection, not a public port-forward; protect the existing pairing token.

## Evidence and limits

- The private Android static research established `UserActivity.username`, `ListeningActivity.entity_uri`, `is_playing`, `timestamp`, and `context_uri`. That is architectural evidence, not a callable third-party API.
- The working desktop Spicetify DOM path already extracts an exact track URI from visible Following rows without OCR; it is the source for this implementation.
- No legal conclusion about Spotify's commercial terms or streaming-policy compliance is made by the existence of a source adapter.
- This branch is additive and deliberately isolated from the working desktop installation until reviewed and tested.
