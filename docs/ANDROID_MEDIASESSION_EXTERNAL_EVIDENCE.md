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

## Independent Spotify measurement

The open-source Android project Sleevesight documents a platform probe performed on a Samsung Galaxy S25 Ultra running Android 16 / API 36 with Spotify as the reference player. Its design record reports the following measured Spotify MediaSession behavior:

- Spotify publishes `MediaMetadata.METADATA_KEY_MEDIA_ID` as an exact `spotify:track:<id>` URI.
- Spotify advertises play/pause, previous, next, seek, play-from-search, and **play-from-URI** in `PlaybackState.getActions()`.
- The tester sent and confirmed ordinary play/pause/next/previous commands; the document explicitly says play-from-search and play-from-URI were **advertised but not tried**.
- Spotify also publishes a queue containing `spotify:track:` media IDs.

Source:

- https://github.com/wkusnierczyk/sleevesight/blob/main/design/design.md

The repository's measurement date is recorded as 2026-10-12 for the Android 16 platform probe.

## Interpretation for Track Mirror

This evidence materially strengthens the MediaSession hypothesis because Spotify reportedly advertises exactly the Android action Track Mirror intends to invoke, and Spotify's own MediaSession metadata uses the same `spotify:track:<id>` identifier form Track Mirror wants to supply.

However, the decisive behavior remains unverified. Advertising `ACTION_PLAY_FROM_URI` does not prove that Spotify accepts every URI scheme or every `spotify:track:` URI supplied by an arbitrary controller. Spotify could validate callers, constrain accepted URIs, route the callback differently, or ignore a request despite advertising the capability.

Therefore classify current evidence as:

- Android API support for URI playback: **verified by Android documentation**.
- Spotify advertising `ACTION_PLAY_FROM_URI` on at least one recent Android 16 physical-device test: **independently measured by Sleevesight; not yet reproduced by Track Mirror**.
- Spotify MediaSession exposing current track IDs as `spotify:track:<id>`: **independently measured by Sleevesight; not yet reproduced by Track Mirror**.
- Spotify honoring Track Mirror's arbitrary `playFromUri(spotify:track:<id>)`: **unverified; this remains the spike's primary test**.

## Reverse-engineering questions

The repository-owner-selected REA → JADX → Ghidra workflow should focus on the narrower remaining questions rather than rediscovering Android's generic MediaSession API:

1. Locate Spotify's MediaSession callback / command-dispatch implementation.
2. Identify the handling path for the play-from-URI action or callback.
3. Determine whether `spotify:track:` is accepted directly, normalized, rejected, or transformed.
4. Compare that path with the path used by Spotify's published `MEDIA_ID` values and queue item IDs.
5. Identify any caller/package/signature checks or policy gates before playback dispatch.
6. Follow JNI/native calls only where the managed Android path crosses into native libraries.
7. Treat static-analysis conclusions as hypotheses until confirmed by runtime testing.

## Commercial relevance

If Spotify both advertises and honors the standard Android MediaSession play-from-URI command, Track Mirror's Android follower playback path could potentially rely on an operating-system media-control surface rather than Spotify App Remote or Web API playback commands. That would reduce technical dependence on Spotify developer playback interfaces.

This technical finding would not by itself resolve Spotify contractual terms, Google Play policy, notification-listener disclosure, trademark, or other release/legal questions. Those remain separate review items.
