# Android MediaSession Spike

Status: experimental branch `android-mediasession-spike`

Date started: 2026-10-23

## Goal

Determine whether Track Mirror can control the follower's installed Spotify client through Android's own MediaSession framework, without using Spotify App Remote or Spotify Web API playback commands.

The original decisive question was:

> When Spotify has an active Android media session, does Spotify honor `MediaController.TransportControls.playFromUri()` when Track Mirror supplies an exact `spotify:track:` URI?

Public research completed during the spike now shows that this exact route is less promising than first expected: Spotify has been independently observed advertising `ACTION_PLAY_FROM_URI` while a controlled real-session exact-track attempt still timed out without changing recordings. Track Mirror must reproduce that result itself before the route is ruled in or out for its chosen Spotify build/device.

The broader Android question is now:

> Can Track Mirror select an exact Spotify recording through a standard Android/Spotify handoff, then use Android MediaSession for reliable state and ordinary transport, without making Spotify developer playback APIs the required commercial path?

## Repository-owner decisions

The following are repository-owner product/development decisions, not merely implementation defaults:

- prioritize the Android MediaSession route as the current commercial-safe playback experiment after review of the alternatives;
- use an Android emulator first for repeatable day-to-day development and MediaSession experimentation;
- follow emulator success with physical-device testing before treating Spotify/MediaSession behavior as proven for real-world use;
- keep the existing App Remote path intact while this experiment is evaluated;
- on the current CachyOS/COSMIC development machine, run the Android emulator headlessly and use ADB/scrcpy for viewing and control because moving the native emulator window repeatedly froze desktop pointer/window interaction; this is the preferred development workflow unless the native-window issue is later shown to be resolved;
- use REA as the preferred Spotify reverse-engineering orchestration workflow, with JADX first for Android/Dex and Ghidra selectively for native/JNI code, followed by controlled runtime confirmation.

AI assistance may provide implementation code, testing procedures, documentation, research and analysis, but these product/development choices are attributed to the repository owner.

## What this spike changes

The branch adds experimental Android-only paths alongside the existing Spotify App Remote path. It does **not** replace normal mirroring behavior yet.

Current experimental capabilities:

- open Android's notification-listener/media-control access settings;
- query Android's active media sessions;
- identify an active Spotify media session by package name;
- report Spotify's current session metadata/state;
- report the current Spotify `MEDIA_ID` and advertised playback-action set;
- send `playFromUri(spotify:track:...)` only when Spotify advertises `ACTION_PLAY_FROM_URI`;
- send an experimental `playFromSearch("spotify:track:<id>", null)` only when Spotify advertises `ACTION_PLAY_FROM_SEARCH`;
- launch an exact `spotify:track:` deep link targeted to the installed Spotify app as a separate experiment;
- send `pause()` through the Android media controller;
- automatically re-check Spotify's MediaSession after each exact-track experiment and report success only when Spotify's resulting `MEDIA_ID` equals the requested exact URI.

The existing App Remote adapter remains intact for comparison and fallback during testing. `process_and_apply_mirror_event` still uses the existing App Remote mobile path; none of the experimental routes is silently promoted to normal mirroring.

## Why notification-listener access is present

Android allows an enabled `NotificationListenerService` to retrieve active media sessions through `MediaSessionManager.getActiveSessions(ComponentName)` without holding the signature-level `MEDIA_CONTENT_CONTROL` permission.

Track Mirror's spike declares a minimal notification-listener service for this purpose. The service implementation does not inspect, store, or process notification contents. The user must explicitly enable the access in Android settings.

Independent Android projects use the same narrow pattern: notification-listener access to obtain active `MediaController` instances, followed by MediaSession callbacks/transport controls, without requiring notification-content processing for media control.

This permission model must still be reviewed separately for Play Store policy, disclosure and consent before any commercial release.

## Emulator environment established

The repository owner's emulator-first validation decision was implemented on the CachyOS development machine.

Validated environment on 2026-10-23:

- AVD name: `medium_phone`;
- Android release: 16;
- API level: 36;
- emulator serial: `emulator-5554`;
- architecture: `x86_64`;
- Google Play Store package present: `com.android.vending`;
- Google Play Services package present: `com.google.android.gms`;
- Linux KVM device present and accessible.

Spotify installed from Google Play in that emulator was version `9.1.92.3058` (`versionCode=147346334`, targetSdk 37). Spotify's login activity remained black while the Android guest and scrcpy display otherwise worked. Logcat showed Spotify alive in `LoginActivity` without a fatal exception, alongside x86_64 and EGL/HWUI warnings. This made the emulator unsuitable for completing the Spotify runtime test at that point.

An Android 15 / API 35 Google Play image was downloaded for comparison, but AVD creation hit an `avdmanager`/`devices.xml` tooling problem before a second test device was created.

## Host-window workaround and host-session warning

The Android emulator's native graphical window repeatedly caused the CachyOS/COSMIC desktop to freeze pointer/window interaction when the emulator window was dragged. The same behavior persisted when the emulator UI was forced through X11/XWayland.

The repository owner approved a safer workflow: run the Android virtual device headlessly and view/control it through `scrcpy` over ADB. That avoided the native emulator window and allowed a movable Android display.

Later, after repeated emulator/graphics experiments, the COSMIC/XWayland host session became unreliable: Signal's X11 launch failed because the XWayland process had disappeared while `DISPLAY=:1` and the X socket remained. No NVIDIA Xid/OOM problem was found, and memory/load were healthy. Development was stopped rather than continue destabilizing the host.

**Recovery rule for the next local session:** restore/verify the host COSMIC/XWayland environment first. Do not resume Android emulator experiments until ordinary desktop applications, especially Signal's known-good X11 path, are functioning normally.

## External evidence gathered during the spike

See `docs/ANDROID_MEDIASESSION_EXTERNAL_EVIDENCE.md` and `docs/ANDROID_PLAYBACK_FALLBACK_MATRIX.md` for the detailed source record. The key conclusions are:

### MediaSession state and ordinary transport are strong

Independent Android 16 physical-device work reports that Spotify:

- publishes exact `spotify:track:<id>` values as `MediaMetadata.METADATA_KEY_MEDIA_ID`;
- advertises play/pause, previous, next, seek, play-from-search and play-from-URI;
- responds correctly to ordinary play/pause/previous/next commands;
- publishes useful queue/context metadata.

This strongly supports MediaSession as Track Mirror's Android state/transport surface.

### Advertised play-from-URI is not enough

RunState independently implemented the same standard Android exact-track route and verified results from Spotify's MediaSession rather than trusting dispatch. Its recorded real Spotify trial found:

- Spotify advertised prepare-from-URI and play-from-URI;
- media-ID loading was not advertised;
- prepare-from-URI did not load the target;
- explicit `playFromUri()` also timed out after about five seconds;
- the prior paused recording remained selected.

Therefore Track Mirror must not infer exact-track support from the advertised action bit alone.

### Spotify MediaBrowser is not a general fallback

MiniSpot, a working lightweight Spotify remote, explicitly documents in source that Spotify refuses its media-browser connection. It therefore uses notification-listener MediaSession access for generic remote control. This makes ordinary phone Spotify's MediaBrowserService a low-priority fallback for Track Mirror.

### Exact deep-link selection is promising but foregrounding

Spotify's official Android content-linking documentation supports direct content navigation and says it brings Spotify to the foreground. Spotify Duo independently reports measured real-device behavior where both `spotify:track:` and `open.spotify.com/track/` links restart/play the selected track.

This makes exact deep linking a promising exact-ID selection route, but it carries two unresolved costs:

- Spotify may visibly take foreground focus on every mirrored track change;
- Android background-activity-start restrictions may prevent or constrain unattended/background use.

### `playFromSearch` is worth a narrow experiment

Spotify independently advertises play-from-search. Svartifoss reports that name-based `playFromSearch` is an outside command Spotify honors, while also using an issue-and-verify ladder because advertised `playFromUri` can be swallowed.

Track Mirror therefore adds a deliberately narrow hypothesis test:

`playFromSearch("spotify:track:<id>", null)`

No evidence yet establishes that Spotify interprets the exact URI string as an exact search resource. Success is counted only if Spotify's resulting `MEDIA_ID` equals the requested URI.

## Validation rule

**Command dispatch is never success.**

For exact-track experiments, Track Mirror must verify the post-command Spotify MediaSession identity. Preferred proof:

`MediaMetadata.METADATA_KEY_MEDIA_ID == requested spotify:track:<id>`

A non-throwing Android call, an advertised action bit, audible playback, or Spotify being foregrounded is insufficient by itself.

The spike UI now applies this rule automatically: it dispatches the selected experiment, waits briefly, re-queries Spotify's MediaSession, and reports `verifiedExactTrack` based on exact `MEDIA_ID` equality. A manual **Check Spotify session** control remains available.

## Current validation sequence

### Stage 0 — host recovery

Before more emulator/device work on the CachyOS machine:

1. verify COSMIC session health;
2. verify XWayland is running and Signal's X11 launch works;
3. confirm no stale emulator/scrcpy/qemu processes;
4. only then restart Android tooling.

### Stage 1 — physical/emulator playback experiments

With a functioning Spotify installation and active Spotify media session:

1. enable Track Mirror media-control access;
2. press **Check Spotify session** and record `mediaId`, playback state and advertised actions;
3. choose a different exact `spotify:track:<id>`;
4. test **MediaSession URI** once;
5. test **URI as search query**;
6. test **Spotify deep link** from a visible Track Mirror activity;
7. compare the verified resulting `mediaId` for each route;
8. test pause/state control separately.

If MediaSession URI fails as RunState observed, do not keep retrying it without new evidence from REA/JADX explaining a missing condition.

### Stage 2 — lifecycle/background behavior

For any exact-track route that succeeds, repeat under:

- Track Mirror visible;
- Spotify foreground;
- unrelated app foreground;
- Track Mirror background;
- screen off/device locked.

Deep-link success while Track Mirror is visible does not establish background viability.

### Stage 3 — physical-device confirmation

Any behavior first observed in an emulator must be repeated on at least one real Android phone before being treated as product-valid. Emulator success alone does not prove OEM/background/audio-focus or production Spotify behavior.

## Result interpretation

### A. MediaSession exact URI works on Track Mirror's test device

Keep the route under test, but still require physical confirmation and lifecycle/background coverage because external evidence shows the behavior is not universal.

### B. MediaSession exact URI fails; URI-as-search succeeds exactly

Investigate Spotify's `onPlayFromSearch` path with REA/JADX, confirm identity over multiple tracks/devices, and determine whether this can be a stable OS-level exact-selection adapter.

### C. Exact deep link succeeds but foregrounds Spotify

Treat exact selection as technically viable but UX/background-constrained. Test a hybrid model:

1. exact deep-link selection;
2. wait for Spotify MediaSession to expose requested `MEDIA_ID`;
3. use MediaSession for ongoing play/pause/seek/state.

Do not promote this architecture until the foreground/background implications are acceptable.

### D. Search is best-match only and deep-link background use is unacceptable

MediaSession remains valuable for state/transport but not arbitrary exact selection. Re-evaluate commercial-safe exact-selection options, including the policy implications of Spotify developer interfaces, without pretending generic MediaSession solves the problem.

## Reverse-engineering path

The repository owner selected:

**REA → JADX → Ghidra only where JNI/native analysis is actually needed → controlled runtime confirmation.**

The first-pass query plan is in `docs/SPOTIFY_REVERSE_ENGINEERING_WORKFLOW.md`.

The local Spotify APK capture helper is:

`scripts/capture-spotify-apks-for-analysis.sh`

It stores research material under `~/track-mirror-research/` outside Git, records version/package paths and hashes, and inventories APK/native contents. Spotify binaries, extracted libraries and decompiled code must not be committed or redistributed with Track Mirror.

## Architecture rule during the spike

Do not route normal `MirrorAction::PlayTrack` through MediaSession, search, or deep-link experiments until an exact-track route is proven on a physical device and deliberately selected by the repository owner.

The current branch deliberately keeps the normal production/reference path unchanged so failed experiments cannot silently regress the existing mobile proof of concept.

## Commercial significance

The strongest current Android commercial-safe hypothesis is no longer "MediaSession does everything." It is a separation of responsibilities:

```text
exact-track selection
    -> still under test (search / exact link / other standard handoff)

MediaSession
    -> strong candidate for state + ordinary transport
```

Reducing dependence on revocable Spotify developer playback interfaces remains strategically valuable, but technical feasibility does not by itself determine Spotify contractual compliance, Google Play policy, notification-listener disclosure, trademark, or other release/legal questions. Reverse engineering is treated as interoperability research subject to separate legal review.
