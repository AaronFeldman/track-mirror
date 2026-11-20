# Android Listening Activity — Static Research Handoff

Reviewed: 2026-11-19. **This is a recovery and interpretation of captured October 28, 2026 evidence, not a new Android runtime test.**

## Purpose and scope

Investigate whether Android Spotify contains a direct source of another listener's shared track metadata for Track Mirror, while keeping actual playback inside each follower's own Spotify client. Keep this exploratory static analysis **separate from** the existing working Linux Spicetify proof of concept and the prioritized lightweight phone remote.

Do not commit the Spotify APK, decompiled Spotify code, user identifiers, credentials, tokens, or captured network traffic. The APK and detailed analysis material belong outside Git under the user's `~/track-mirror-research` directory.

## Provenance

- Spotify Android version: `9.1.92.3058`; versionCode `147346334`.
- APK analyzed: `~/track-mirror-research/spotify-apk/9.1.92.3058_147346334/apks/base.apk`.
- Captured APK SHA-256: `c26e20a8ce9db36fd0b6021542c75abcaf4e923557b8a21058b502e295d62928`.
- JADX headless static analyzer: `0.7.1`; class count `99,161`.
- Evidence retained in the ChatGPT Library under descriptive filenames including `rea-presence-daemon.txt`, `rea-listening.txt`, `inspect-d4c0.txt`, `method-n5c0-a.txt`, `refs-n5c0-a-method.txt`, and `method-iz10-o.txt`.

## Observed, not conjectured

1. Exact class-name search for `ListeningActivityPresenceDaemon` produced zero matches in the loaded APK's top-level JADX class inventory. Another proposed original name, `com.spotify.listeningactivity.presence.impl.PresencePushActivity`, also was not found. Those negative searches do **not** exclude an obfuscated equivalent.
2. `com.spotify.listeningactivity.v1` contains `SubscribePresenceRequest`, `PresenceResponse`, `UserActivity`, `UsersActivityRequest/Response`, `UsersSubscriptionRequest`, `UsersUnsubscriptionRequest`, and related feed/audience data types.
3. Decompiled `p.n5c0.a(String)` builds a `SubscribePresenceRequest` with a `SubscribePresenceRequest.PusherChannel` populated from the supplied string. The meaning/origin of that string remains unverified.
4. The sole recorded direct call to `p.n5c0.a(String)` is `p.iz10.o(Object)` (in `classes7.dex`). Its fallback disassembly calls `p.d4c0.f(SubscribePresenceRequest, continuation)` and handles a `PresenceResponse`.
5. The same `p.iz10.o` disassembly iterates `UserActivity` records, passes them through `p.n5c0.b(UserActivity)` to `p.w2c0`, and emits a result through a coroutine flow. The method includes a presence-listener subscription failure diagnostic.
6. `p.d4c0` is a 12-method listening-activity service interface. Its observed method signatures include `f(SubscribePresenceRequest) -> PresenceResponse`, `g(UsersActivityRequest) -> UsersActivityResponse`, `i(UsersSubscriptionRequest) -> UsersActivityResponse`, `k(UsersUnsubscriptionRequest)`, and `c(GetFeedRequest) -> GetFeedResponse` (shown without coroutine continuation for legibility).

## Interpretation and limits

The APK contains an actual request/response processing path for presence and listening activity, not merely unused prose strings. However, static calls alone do not demonstrate that Track Mirror can obtain a user's live friend feed, that a particular endpoint is active, that it is accessible to third-party apps, or that its use would be authorized. A `PresenceResponse` may be a subscription acknowledgment/initial snapshot rather than a continuously delivered stream. Do not conflate the two.

## Next exact, read-only investigations

1. Inspect `p.n5c0.b(UserActivity)` and `p.w2c0`: identify which outputs represent Spotify track URI, listener identity, timestamp, and playback state, without guessing field semantics.
2. Trace callers and constructors of `p.iz10.o` and `p.n5c0`: identify the source of the string used for `PusherChannel` and how the reactive stream is established.
3. Inspect the implementation/annotations of `p.d4c0` and the call sites of `f`, `g`, `i`, and `k`: distinguish presence subscription, direct users-activity fetch, feed, and unsubscription.
4. Cross-reference known candidates `p.isw0`, `p.o690`, `p.c0t`, `p.fsn0`, `p.x76`, `p.xop0`, `EsConnectionId.getId()`, and string routes under `listening-activity/v1`, if the **same APK fingerprint** is present. Names are build-specific and may change.
5. Investigate user-permitted, documented or UI-mediated integration routes before contemplating any reliance on a proprietary private protocol. Do not replay captured requests, collect credentials, intercept unrelated users' sessions, or add private Spotify code into Track Mirror.

## Current engineering decision

No new Android listening-activity integration is validated yet. Retain the desktop Spicetify adapter and the thin Android remote-controller priority; a static APK discovery is a research lead, **not** a reason to replace the working path.

## Reproducible local probe

On the Linux machine holding the archived APK, with `jadx` CLI on `PATH`, run:

```sh
bash scripts/inspect-spotify-presence.sh
```

The script verifies the SHA-256 fingerprint and then decompiles **only** `p.n5c0`, `p.d4c0`, `p.iz10`, and `p.w2c0` using JADX's `--single-class` option. Output remains at `~/track-mirror-research/spotify-apk/9.1.92.3058_147346334/presence-probe/`, outside the repository. The summary is `summary.txt`; class-level outputs and logs stay local. No network calls, authentication, APK changes, or Spotify playback actions are performed. The script's shell syntax and flow were verified with a fixture, **not** against the unavailable original APK.
