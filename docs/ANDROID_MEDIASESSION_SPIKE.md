# Android MediaSession Spike

Status: experimental branch `android-mediasession-spike`

Date started: 2026-10-23

## Goal

Determine whether Track Mirror can control the follower's installed Spotify client through Android's own MediaSession framework, without using Spotify App Remote or Spotify Web API playback commands.

The decisive question is:

> When Spotify has an active Android media session, does Spotify honor `MediaController.TransportControls.playFromUri()` when Track Mirror supplies an exact `spotify:track:` URI?

If yes, this route becomes the preferred Android commercial playback adapter candidate.

## What this spike changes

The branch adds an experimental Android-only path alongside the existing Spotify App Remote path. It does **not** replace normal mirroring behavior yet.

Added experimental capabilities:

- open Android's notification-listener/media-control access settings;
- query Android's active media sessions;
- identify an active Spotify media session by package name;
- report Spotify's current session metadata/state when available;
- send `playFromUri(spotify:track:...)` through Android `MediaController.TransportControls`;
- send `pause()` through the same Android media controller.

The existing App Remote adapter remains intact for comparison and fallback during testing.

## Why notification-listener access is present

Android allows an enabled `NotificationListenerService` to retrieve active media sessions through `MediaSessionManager.getActiveSessions(ComponentName)` without holding the signature-level `MEDIA_CONTENT_CONTROL` permission.

Track Mirror's spike declares a minimal notification-listener service for this purpose. The service implementation does not inspect, store, or process notification contents. The user must explicitly enable the access in Android settings.

This permission model must be reviewed separately for Play Store policy and user disclosure before any commercial release. The current branch is an engineering experiment only.

## Test sequence

Use a physical Android phone with Spotify installed.

1. Install/run the Track Mirror Android spike build.
2. Open Spotify manually and start any track so Spotify publishes an active media session.
3. Return to Track Mirror.
4. In **Android MediaSession spike**, press **Enable media-control access**.
5. Enable Track Mirror in Android's notification-listener settings and return to Track Mirror.
6. Press **Check Spotify session**.
7. Success at this stage means Track Mirror reports `accessGranted: true` and `spotifySessionFound: true`.
8. Paste an exact URI such as `spotify:track:<id>` for a track different from the one currently playing.
9. Press **Test exact-track play**.
10. Observe Spotify directly.

### Primary success criterion

Spotify switches to and begins playing the exact requested track after Track Mirror sends Android `playFromUri()`.

### Secondary success criteria

- the command works while Spotify is backgrounded;
- the command works while the screen is off;
- `pause()` works reliably through the same session;
- the Spotify session remains discoverable after pause;
- repeated track changes do not require reopening Spotify manually.

## Result interpretation

### A. Exact `playFromUri` works

This is the preferred outcome. Next steps:

1. replace Android App Remote execution with a MediaSession adapter behind the existing Rust playback interface;
2. retain App Remote only as a historical/noncommercial test adapter;
3. test lifecycle/background behavior extensively;
4. design a clear permission onboarding flow for media-control access;
5. perform Play Store policy review for notification-listener use and disclosure.

### B. Spotify session is visible, pause/play work, but `playFromUri` is ignored

Android can control transport state but Spotify does not resolve arbitrary URI requests through MediaSession. Next experiments should be narrowly ordered:

1. inspect Spotify's advertised playback actions/session metadata;
2. test `playFromMediaId()` only if the session exposes a usable media ID convention;
3. test `playFromSearch()` only as a fallback experiment, not as the preferred exact-ID architecture;
4. test OS-level Spotify deep-link handoff combined with MediaSession transport control.

### C. Spotify session cannot be retrieved

Check:

- Track Mirror notification-listener access is actually enabled;
- Spotify has active/recent playback;
- device/vendor restrictions on notification listeners;
- work-profile or low-RAM restrictions on older Android versions.

### D. Android grants session access but Spotify exposes no controllable session

Treat MediaSession as nonviable for this Spotify build/device combination and move to the OS-level deep-link path.

## Architecture rule during the spike

Do not route normal `MirrorAction::PlayTrack` through MediaSession until the exact-track behavior is proven on a physical device.

The current branch deliberately keeps the normal production path unchanged so a failed experiment cannot silently regress the existing mobile proof of concept.

## Commercial significance

This spike is strategically important because Android MediaSession is an Android operating-system control surface rather than Spotify App Remote or Spotify Web API playback control. A successful result would substantially reduce Track Mirror's dependence on revocable Spotify developer playback permissions.

That architectural advantage does not itself determine Play Store or Spotify legal/policy compliance; those questions remain separate review items before commercial release.
