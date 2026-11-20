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

## Cloud comparative test — 2026-11-19 (local) / 2026-11-20 UTC

The original APK was not available to the cloud runner. A GitHub Actions research job on branch `research/android-presence-cloud-2026-11` downloaded two publicly archived XAPK variants for Spotify `9.1.92.3058` / versionCode `147346334`, each extracting `com.spotify.music.apk` with SHA-256 `bf9ae85fee0e7b4a3ba07e444288dc88003381f865dff5475dad266835858dba`. This is **not identical** to the original archived `base.apk` SHA-256 `c26e20a8ce9db36fd0b6021542c75abcaf4e923557b8a21058b502e295d62928`. The first cloud job correctly refused to decompile a mismatch. A second job proceeded, explicitly labeling it a *different research sample*.

JADX CLI 1.5.6 then generated single-class outputs for `p.n5c0` (1,314 bytes), `p.d4c0` (8,658 bytes), `p.iz10` (134,932 bytes), and `p.w2c0` (720 bytes). Two CLI invocations reported errors (`p.iz10`: 11; `p.w2c0`: 1), though source files were produced. The job's **inspection step succeeded**, while the overall workflow was marked failed after two parallel jobs conflicted trying to commit a status file. One status report is available on the research branch at `docs/CLOUD_ANDROID_PRESENCE_RESULT.md`.

The public variant also exposes `p.n5c0.a(String) -> SubscribePresenceRequest` and `p.n5c0.b(UserActivity) -> p.w2c0`, supporting continuity of the observed source pathway across these two APK samples. Do not conclude that APKs are otherwise identical or that the private Spotify service is supported for external app use. No live runtime test, user account access, Tailscale access, intercepted traffic, or Spotify audio was involved.

Workflow under review: [research PR #3](https://github.com/AaronFeldman/track-mirror/pull/3) (draft; not merged). GitHub cloud execution was sufficient for this static comparative test; the desktop and KDE Connect/Tailscale configuration remained untouched.

## Preserving decompiled source for reuse

The repository owner explicitly requested that decompilation work be saved for future research rather than discarded after transient cloud execution. Retain the **complete decompiled classes and logs** together with fingerprints and tool versions when technically available, but **never commit readable Spotify proprietary code or APKs to the public Track Mirror repository**.

An owner-controlled RSA-3072 key pair and verified Python decryption tool were generated on 2026-11-19, then packaged in the owner's private ChatGPT Library under `/Track Mirror/track-mirror-private-research-recovery.zip`. This private key must **not** be committed to GitHub. A GitHub Actions workflow on the research branch `research/android-presence-cloud-2026-11` uses the public key to encrypt a tar.gz archive of four targeted class outputs and their JADX logs with AES-256-GCM, wrapping the AES key with RSA-OAEP-SHA256. The encrypted result is configured as a GitHub Actions artifact (requested retention: 90 days). The public branch and logs must contain only class identifiers, SHA fingerprints, and metadata, not raw decompiled bodies. This cloud artifact is not a permanent backup: the owner must download and privately retain the encrypted artifact and its decryption key.

**Verification distinction:** the decryption tool has passed an offline round-trip test with synthetic data. This verification condition was subsequently satisfied by the successful cloud run described below. The archived original APK is on the owner's Linux machine; the public comparison build has a different SHA and must remain separately labeled.

## Verified encrypted source archive and observed field mapping — 2026-11-19 / 2026-11-20 UTC

The corrected cloud workflow successfully completed (GitHub Actions run **44649243597**). Its 90-day encrypted artifact ID is **14589644991**, `track-mirror-presence-encrypted-source`, expiring **2027-02-18** unless the repository retention policy changes. The GitHub encrypted artifact was downloaded and independently decrypted and SHA-256-verified in a private working environment with the owner-held key. The resulting tar archive contains `p.n5c0.java`, `p.d4c0.java`, `p.iz10.java`, `p.w2c0.java`, four JADX logs, and a manifest of the **public comparison APK** fingerprint `bf9ae85fee0e7b4a3ba07e444288dc88003381f865dff5475dad266835858dba`. The original APK fingerprint is different, as recorded above.

**Durable private copies were uploaded to the owner's ChatGPT Library:**
- `/Track Mirror/track-mirror-presence-encrypted-source.zip`: the fully encrypted research source archive, saved privately rather than publicly committing source files
- `/Track Mirror/track-mirror-private-research-recovery.zip`: owner-held private key, public key, integrity-checking decryptor, and instructions

The public Track Mirror repository contains the encryption workflow and high-level observations only, not decompiled source or the decryption key. This archival step is **completed and independently verified**, but no statement is made that private Spotify APIs are externally authorized or supported.

**New direct static observation from the privately decrypted `p.n5c0` class**: its `b(UserActivity)` mapper extracts the listener `username` using `getUsername()`. When an activity payload is present, it constructs a second object holding (1) an optional timestamp converted to milliseconds from seconds and nanoseconds, plus (2) three additional values taken from nested activity getters, one optional depending on a presence flag. It then wraps username and the optional activity object in `p.w2c0`. This distinguishes **listener identity** and **activity availability** from yet-unresolved track metadata; the remaining getter meanings must be identified from `p.v2c0` and `ListeningActivity` before naming any one as a Spotify track URI.

Next target: decompile `p.v2c0` and `com.spotify.listeningactivity.v1.ListeningActivity` from the **same comparison APK fingerprint**, then correlate the nested `UserActivity` getter types with its fields. Continue using private encrypted source archives rather than exposing proprietary code in the public repository.

## Verified protobuf field semantics — seven-class cloud archive

A second complete encrypted cloud workflow run (**44649820911**) produced encrypted Actions artifact **14590416943**, `track-mirror-presence-fields-encrypted-source`, requested retention through **2027-02-18**. It was independently downloaded, decrypted with the owner-held key, and hash-verified. The archive contains the original four isolated classes plus `p.v2c0`, `com.spotify.listeningactivity.v1.ListeningActivity`, and `com.spotify.listeningactivity.v1.UserActivity`, as well as their JADX logs and manifest. Fingerprint: comparison APK SHA-256 `bf9ae85fee0e7b4a3ba07e444288dc88003381f865dff5475dad266835858dba` (NOT the original archived base APK).

Private archival copy: `/Track Mirror/track-mirror-presence-fields-encrypted-source.zip` in the owner's ChatGPT Library. The same separate owner-held decryption key in `/Track Mirror/track-mirror-private-research-recovery.zip` works. Neither readable decompiled classes nor a private key were committed to the public repository.

**Direct observed protobuf field mapping:**

- `UserActivity` has `USERNAME_FIELD_NUMBER = 1` and `ACTIVITY_FIELD_NUMBER = 2`.
- `ListeningActivity` defines `ENTITY_URI_FIELD_NUMBER = 1`, `IS_PLAYING_FIELD_NUMBER = 2`, `TIMESTAMP_FIELD_NUMBER = 3`, `CONTEXT_URI_FIELD_NUMBER = 4`.
- The observed `p.n5c0.b(UserActivity)` mapping extracts `username`, and, when activity is present, creates `p.v2c0` with an optional millisecond timestamp, `entity_uri`, optional `context_uri`, and `is_playing`.
- The timestamp conversion uses protobuf seconds multiplied by 1,000 plus nanoseconds divided by 1,000,000; if `hasTimestamp` is false, the output timestamp is null.
- The context URI is conditionally supplied when the corresponding protobuf presence bit indicates it exists.
- `p.v2c0` stores the string URI fields and play-state boolean, while `p.w2c0` combines this optional activity data with the user identifier.

**Interpretation:** `entity_uri` is the specific metadata field to test for the exact `spotify:track:` identity, but not every entity is guaranteed to be a song. Treat playback `is_playing` and the timestamp separately. The static APK does not prove any third-party app has permission to subscribe to, authenticate against, or continuously receive this private listening-activity feed. Keep the existing Spicetify/desktop host and thin Android remote functional until such integration is validated by supported means.

Next research milestone: determine whether an approved or user-consented integration path delivers these already-understood fields in practice. If an adapter becomes justified, map the observed fields into Track Mirror's portable Rust `MirrorEvent` without copying any Spotify implementation source.
