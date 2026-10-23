# Android Exact-Track Playback — Experimental Fallback Matrix

Status: AI-assisted research / engineering analysis; not a repository-owner architecture decision

Date: 2026-10-23

## Purpose

The Android MediaSession spike began with one narrow question: whether the ordinary Spotify phone app honors `MediaController.TransportControls.playFromUri()` for an exact `spotify:track:<id>` supplied by Track Mirror.

External evidence now shows that Spotify can advertise `ACTION_PLAY_FROM_URI` while an independent real-session test still fails to switch recordings. This matrix separates **exact-track selection** from **ordinary transport control** and ranks the next experiments without prematurely changing Track Mirror's canonical Android architecture.

Any route selected for the product still requires repository-owner approval and Track Mirror's own physical-device validation.

## Evidence summary

### Strongly supported

- Android MediaSession can expose Spotify's active session through an enabled notification-listener component.
- Spotify publishes current track identity as `spotify:track:<id>` in recent physical-device observations.
- Spotify MediaSession ordinary transport controls — play, pause, next, previous and seek — work in independent physical-device observations.
- Spotify advertises play-from-URI and play-from-search on at least some recent sessions.
- Spotify officially documents Android content linking through `ACTION_VIEW`; opening Spotify content brings Spotify to the foreground with the selected content.
- Spotify documents a Spotify URI as the resource identifier for a track/album/artist and documents Spotify URLs as client-navigation links.

### Material negative evidence

- RunState reports a controlled real Spotify session where both prepare-from-URI and explicit play-from-URI failed to change to the requested recording despite Spotify advertising the URI actions. The previous paused recording remained selected after an approximately five-second confirmation window.
- MiniSpot's source states that Spotify refuses its media-browser connection; MiniSpot therefore uses notification-listener MediaSession access for generic remote control instead of treating Spotify's browser service as an unrestricted third-party browse/control API.

### Promising but foregrounding

- Spotify Duo reports a measured real-device result that both `spotify:track:` and `open.spotify.com/track/` links act as play commands and restart the selected song. Its Android code targets Spotify with `ACTION_VIEW`.
- Spotify's official Android content-linking documentation says direct content linking brings Spotify to the foreground.
- Android restricts background activity starts, with restrictions tightened in recent releases. Therefore a deep-link selection route may be reliable only when Track Mirror is user-visible or another background-start exemption legitimately applies.

### Issue-and-verify fallback evidence

Svartifoss implements a general Android streaming-player ladder that is directly relevant to Track Mirror's test design:

1. if the target app already exposes an active session, issue `playFromUri` and then verify that playback identity actually changed;
2. if that is swallowed, try the target app's media-browser route;
3. if the browser route cannot serve the request, fall back to a visible deep-link open and then retry transport commands while the new session/content warms up.

Its current notes explicitly say that trusting an advertised `ACTION_PLAY_FROM_URI` bit can produce false success, so the command must be followed by identity verification. The same project reports that Spotify generally rejects unknown MediaBrowser clients and that name-based `playFromSearch` is the outside command it has observed Spotify honoring. For precise track/album/playlist entities, however, it keeps the URI authoritative instead of silently substituting search.

This does not establish that `playFromSearch("spotify:track:<id>")` is exact; that remains a Track Mirror hypothesis. It does independently support the architecture principle that every external playback command must be verified from the resulting media session before Track Mirror calls it successful.

## Candidate routes

| Route | Exact identity | Background-friendly | Developer playback API | Current evidence | Test priority |
| --- | --- | --- | --- | --- | --- |
| MediaSession `playFromUri(spotify:track:...)` | Yes | Yes | No | Spotify advertises it; independent real test failed | Reproduce once on Track Mirror physical device, then demote if failure repeats |
| MediaSession `prepareFromUri` then `play` | Yes | Yes | No | Independent real test failed to load target | Low after one Track Mirror reproduction |
| MediaSession `playFromSearch(spotify:track:<id>)` | Potentially yes if Spotify parses URI query | Yes | No | **Unverified hypothesis** | High experimental value |
| MediaSession `playFromSearch(title + artist)` | Best-match, not guaranteed exact | Yes | No | Spotify advertises search; Svartifoss reports Spotify honors outside name-based search | High fallback experiment, but identity risk |
| Structured `playFromSearch` with title/artist extras | Best-match, not guaranteed exact | Yes | No | Standard Assistant/media pattern | High fallback experiment |
| Spotify `ACTION_VIEW` exact track deep link | Yes | No / constrained | No | Official linking surface; independent project measured track links restarting playback | High foreground test; background viability must be tested separately |
| Exact deep link then MediaSession transport | Yes for selection if link succeeds | Selection step constrained | No | Components individually supported; Svartifoss uses a similar visible-open + session-nudge fallback | High hybrid experiment |
| MediaBrowser service | Potentially | Yes | No | MiniSpot and Svartifoss report Spotify generally refuses unknown browser clients | Low for ordinary phone Spotify |
| Skip-to-queue-item | Exact only for an item already in queue | Yes | No | Spotify exposes queue in independent observations | Not a general arbitrary-track solution |
| Spotify App Remote | Yes | Yes after authorization | **Yes** | Existing Track Mirror reference adapter | Technically strong, commercial-policy concern remains |
| Spotify Web API playback | Yes | Yes | **Yes** | Official developer interface | Technically strong, commercial/policy/account constraints remain |

## Verification rule

No experimental route succeeds merely because:

- the Android call returns without throwing;
- Spotify advertises the corresponding action bit;
- Spotify starts playing something; or
- Spotify is brought to the foreground.

For exact-track selection, success requires the post-command Spotify MediaSession identity — preferably `MediaMetadata.METADATA_KEY_MEDIA_ID` — to become the requested exact `spotify:track:<id>` within a bounded confirmation window.

This rule is consistent with the independent RunState and Svartifoss approaches and should govern every Track Mirror playback experiment.

## Recommended physical-device experiment order

This is an engineering recommendation, not a locked product decision.

### 1. Reproduce the negative URI result once

On the ordinary current Spotify phone app:

1. obtain the active Spotify `MediaController`;
2. record current `MEDIA_ID`, title, playback state and advertised action bits;
3. choose a different exact `spotify:track:<id>`;
4. send `playFromUri()`;
5. wait for metadata/state confirmation rather than treating command dispatch as success;
6. record whether the `MEDIA_ID` changes to the target.

If Track Mirror reproduces RunState's failure, do not spend substantial product time retrying the same URI command unless REA/JADX finds a concrete condition that explains the discrepancy.

### 2. Test `playFromSearch()` without losing exact identity

Try, in order:

1. `playFromSearch("spotify:track:<id>", null)`;
2. `playFromSearch("<track title> <artist>", null)`;
3. structured Android media-search extras for title + artist if Spotify's session behavior suggests they are consumed.

For every test, success requires the resulting Spotify `MEDIA_ID` to equal the intended exact track URI. Merely hearing a similarly named song is not sufficient.

The exact-URI-as-search-query variant is deliberately experimental. Spotify documents Spotify URIs as resource identifiers and supports navigating to them in Spotify clients, but no evidence currently establishes that the ordinary Android MediaSession search callback interprets such a query as an exact URI.

### 3. Test exact-track deep linking

From a visible Track Mirror activity:

1. send `ACTION_VIEW` targeted to `com.spotify.music` for the exact track;
2. verify the resulting MediaSession `MEDIA_ID` and playback state;
3. compare `spotify:track:` and `https://open.spotify.com/track/...` forms;
4. determine whether playback starts, restarts, or merely navigates for the current Spotify build/account.

Spotify's current Android content-linking documentation explicitly says content navigation brings Spotify to the foreground, so a visible task switch is expected behavior rather than an implementation accident.

If successful, separately test the UX and Android lifecycle cases:

- Track Mirror visible;
- Spotify already foreground;
- Track Mirror background;
- another unrelated app foreground;
- screen off / device locked.

Do not assume a foreground result works unattended. Android background-activity-launch restrictions are directly relevant.

### 4. Hybrid deep-link + MediaSession

If a deep link reliably selects the exact recording, use MediaSession only after the selection for:

- confirmation of exact `MEDIA_ID`;
- pause/play;
- position/seek;
- state tracking;
- duplicate suppression and synchronization.

This preserves exact identity while keeping ongoing control on the standard OS media surface. Its main unresolved cost is whether each new-track selection causes a visible Spotify task switch or is blocked from Track Mirror's background state.

A possible refinement, modeled on Svartifoss's issue-and-verify ladder, is to retry normal transport only after the deep link has caused Spotify's session/metadata to reflect the target. That should be tested rather than assumed.

## Reverse-engineering targets

The repository-owner-approved REA → JADX → Ghidra investigation should now prioritize questions that can eliminate runtime guesswork:

1. `MediaSession.Callback.onPlayFromUri` / equivalent callback wiring.
2. `onPrepareFromUri` handling.
3. `onPlayFromSearch` and any handling of `spotify:track:` strings or structured Android search extras.
4. `ACTION_VIEW` / app-link handlers for `spotify:track:` and `open.spotify.com/track/`.
5. feature/account/session gates that differ between MediaSession URI requests and deep-link requests.
6. whether ordinary phone and automotive MediaSession paths are materially different.
7. whether a deep-link request can reach playback without requiring a visible Spotify activity transition.
8. whether Spotify's session advertises a capability based on a shared framework layer even when the phone product path later ignores/rejects it.

Static findings must be treated as hypotheses until runtime confirmation. Spotify binaries, decompiled output and copied implementation code remain outside the Track Mirror repository.

## Sources reviewed

Primary/current platform/vendor documentation:

- Android `MediaController.TransportControls` documentation for play-from-URI and play-from-search.
- Android background-activity-launch restrictions and Android 14/15 behavior changes.
- Spotify for Developers Android Content Linking.
- Spotify URI/ID concepts.

Independent public projects:

- `wkusnierczyk/sleevesight` — physical Android 16 Spotify MediaSession measurements.
- `Manley-codes/RunState` — controlled real-session URI-loading attempt and verification logic.
- `anriudh/spotify-duo` — measured track-link playback/restart behavior and targeted `ACTION_VIEW` handoff.
- `virrrresque/minispot` — working lightweight remote; documents Spotify media-browser refusal and notification-listener session control.
- `gabrielluizone/Svartifoss` — issue-and-verify playback ladder, swallowed-command handling, Spotify browser-client limitation and name-search fallback observations.
- `romanchukg-cloud/spotify-android-head-units` — automotive backend comparison only; not treated as proof for ordinary phone Spotify.

## Current engineering conclusion

The most defensible working model is now:

```text
Spotify MediaSession
  strong: state + ordinary transport
  uncertain/negative evidence: arbitrary exact-track playFromUri

Exact-track deep link
  promising for exact selection
  cost: foreground/background-activity behavior

playFromSearch
  evidence of name-based Spotify playback from outside
  exact-identity guarantee still unproven

Verification
  command acceptance never counts
  resulting Spotify MEDIA_ID is the authority
```

No fallback is yet promoted to Track Mirror's canonical Android playback architecture.
