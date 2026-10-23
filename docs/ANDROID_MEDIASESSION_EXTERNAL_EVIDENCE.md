# Android MediaSession — External Evidence

Status: corroborating research only; not Track Mirror runtime proof

Date: 2026-10-23

## Purpose

This note records external evidence relevant to the Track Mirror Android MediaSession spike. It deliberately distinguishes third-party measurements and Android platform contracts from behavior Track Mirror has reproduced itself.

The Track Mirror success criterion remains unchanged: a controlled Track Mirror test must cause the installed Spotify application to switch to an exact requested `spotify:track:<id>` via Android MediaSession, followed by physical-device confirmation.

## Android platform contract

Android's `PlaybackState.ACTION_PLAY_FROM_URI` / `PlaybackStateCompat.ACTION_PLAY_FROM_URI` is the standard action flag indicating that a media session supports a play-from-URI command. Its value is `8192` (`1 << 13`).

Android's `MediaController.TransportControls.playFromUri(Uri, Bundle)` is the corresponding controller operation: it requests that the player start playback for the specified URI.

Primary Android references:

- https://developer.android.com/reference/android/media/session/PlaybackState#ACTION_PLAY_FROM_URI
- https://developer.android.com/reference/android/media/session/MediaController.TransportControls#playFromUri(android.net.Uri,android.os.Bundle)

This establishes what Android means when a session advertises the action. It does not by itself establish Spotify behavior.

## Independent Spotify measurement — Sleevesight

The open-source Android project Sleevesight documents a platform probe performed on a Samsung Galaxy S25 Ultra running Android 16 / API 36 with Spotify as the reference player. Its design record reports the following measured Spotify MediaSession behavior:

- Spotify publishes `MediaMetadata.METADATA_KEY_MEDIA_ID` as an exact `spotify:track:<id>` URI.
- Spotify advertises play/pause, previous, next, seek, play-from-search, and **play-from-URI** in `PlaybackState.getActions()`.
- The tester sent and confirmed ordinary play/pause/next/previous commands; the document explicitly says play-from-search and play-from-URI were **advertised but not tried**.
- Spotify also publishes a queue containing `spotify:track:` media IDs.

Source:

- https://github.com/wkusnierczyk/sleevesight/blob/main/design/design.md

The repository's measurement date is recorded as 2026-10-12 for the Android 16 platform probe.

The historical Sleevesight Phase 0 probe remains available in Git history. Its `Describe.kt` maps the actual `PlaybackState.ACTION_PLAY_FROM_URI` bit to the logged `PLAY_FROM_URI` capability rather than inferring the capability from metadata or documentation. This makes the documented advertisement result materially stronger than a design assumption.

The same historical probe used notification-listener access to obtain active `MediaController` instances, then normal MediaSession callbacks and transport controls. Its ordinary playback-control path did not depend on reading notification contents.

## Independent exact-track attempt — RunState

A second open-source Android project, RunState, contains both implementation code and a development record for real Spotify cross-track loading tests.

Its Android Spotify session code uses the same standard MediaSession decision Track Mirror is testing:

1. if `ACTION_PLAY_FROM_MEDIA_ID` is advertised, call `playFromMediaId(uri, null)`;
2. otherwise, if `ACTION_PLAY_FROM_URI` is advertised, call `playFromUri(Uri.parse(uri), null)`;
3. treat dispatch as only a request and wait for Spotify's session metadata/state to confirm that the target recording actually loaded.

RunState's project record reports a real paused-Spotify trial in which:

- the current recording had a canonical Spotify track URI;
- Spotify advertised prepare-from-URI and play-from-URI;
- Spotify did **not** advertise the media-ID loading action;
- the default prepare-from-URI route failed to load the target within the approximately five-second confirmation window;
- an explicit `play_uri` variant then also failed, with a 5,033 ms load timeout;
- the previous paused song remained selected;
- the project explicitly concluded that advertised commands did not establish working cross-track transport.

Sources:

- https://github.com/Manley-codes/RunState/blob/main/android/app/src/main/java/com/runstate/mobile/music/SpotifySongPassage.kt
- https://github.com/Manley-codes/RunState/blob/main/android/app/src/androidTest/java/com/runstate/mobile/ui/ReflectionVoiceSpeechTest.kt
- https://github.com/Manley-codes/RunState/blob/main/docs/design/project_current_state.md

This is the most directly relevant public evidence found so far. It does not prove that every Spotify Android build/device ignores `playFromUri`, but it demonstrates that **Spotify can advertise `ACTION_PLAY_FROM_URI` while failing to switch to a supplied exact track URI in a controlled real-session test**.

## Other public implementations

Public Android projects show that developers do attempt the same standard MediaSession route, but their evidentiary value varies.

### Spotify Android head-unit project

`romanchukg-cloud/spotify-android-head-units` contains a `MediaControllerCompat` adapter with explicit `playFromUri(Uri.parse(uri), Bundle())`, plus media-ID and search playback paths. Its code comments describe URI playback for Spotify URIs.

However, that project targets a prepared/patched **Spotify Automotive 5.5.0 backend**, not the ordinary current phone Spotify application. Its own verification documentation also cautions that automated fixtures do not certify successful Spotify authentication or audio playback. Treat this as evidence that Spotify's automotive media backend is designed around these standard media commands, not as proof that the phone app honors them.

### MiniSpot

MiniSpot is a working lightweight remote around the official Spotify Android app. Its public code includes a MediaSession `playFromUri` wake/control path, but its documented exact library/search playback model still requires the user's own Spotify developer app/Web API authorization. Its no-login mode is described as a basic remote. This is consistent with treating generic MediaSession transport control and arbitrary exact-track selection as separate capabilities.

## Current interpretation for Track Mirror

The evidence is now mixed rather than simply encouraging:

- Android's API contract says `ACTION_PLAY_FROM_URI` advertises URI playback support.
- Spotify has independently been observed advertising that bit and publishing exact `spotify:track:` identifiers.
- Spotify's ordinary transport controls (play, pause, next, previous, seek) work through MediaSession.
- **At least one independent real-session test found that exact cross-track `playFromUri(spotify:track:...)` did not work despite the advertised action.**

Therefore classify current evidence as:

- Android API support for URI playback: **verified by Android documentation**.
- Spotify advertising `ACTION_PLAY_FROM_URI` on recent physical-device sessions: **independently measured; not yet reproduced by Track Mirror**.
- Spotify MediaSession exposing current track IDs as `spotify:track:<id>`: **independently measured; not yet reproduced by Track Mirror**.
- Ordinary Spotify MediaSession transport control: **independently measured working**.
- Spotify honoring an arbitrary exact `playFromUri(spotify:track:<id>)`: **externally observed failing in at least one controlled real-session test; Track Mirror's own result remains unverified**.

This lowers confidence that `playFromUri` alone will be Track Mirror's final commercial Android exact-track selection mechanism. It does not justify abandoning the spike before Track Mirror reproduces the result on its own chosen Spotify build/device, because Spotify behavior can vary by build, device, session type, account state, or context.

## Reverse-engineering questions

The repository-owner-selected REA → JADX → Ghidra workflow should now focus on explaining the discrepancy between the advertised action and the failed runtime behavior:

1. Locate Spotify's MediaSession callback / command-dispatch implementation.
2. Identify the handling path for `onPlayFromUri` / play-from-URI.
3. Determine whether `spotify:track:` is accepted directly, normalized, rejected, or restricted by context/session type.
4. Determine why Spotify advertises `ACTION_PLAY_FROM_URI` when an external exact-track request can time out unchanged.
5. Compare the URI path with any media-browser / automotive path and with deep-link `ACTION_VIEW` handling.
6. Identify caller/package/signature/account/session checks or feature gates before playback dispatch.
7. Determine whether `playFromSearch`, a media-browser service, queue-item control, or deep-link-plus-transport path offers a standard OS-level fallback.
8. Follow JNI/native calls only where the managed Android path crosses into native libraries.
9. Treat decompiled representations as research evidence, not source code to copy, and treat static conclusions as hypotheses until confirmed by runtime testing.

## Commercial relevance

A standard Android MediaSession route remains strategically attractive because it would reduce technical dependence on Spotify App Remote or Web API playback commands. The RunState result means the exact-track URI route can no longer be assumed viable merely because Spotify advertises it.

The next commercial-safe architecture decision should therefore distinguish:

- **transport control** (MediaSession appears strong for play/pause/seek/next/previous), from
- **exact-track selection** (MediaSession `playFromUri` is now materially uncertain and may require a different OS-level handoff).

Technical feasibility does not itself resolve Spotify contractual terms, Google Play policy, notification-listener disclosure, trademark, or other release/legal questions. Reverse engineering is being treated as interoperability research subject to separate legal review, and Spotify binaries/decompiled code are not to be committed or redistributed with Track Mirror.
