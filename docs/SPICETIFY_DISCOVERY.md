# Spicetify Friend Activity discovery

## Why this exists

Spicetify documents stable-ish access to the local player's state and controls, but it does not document a stable Friend Activity API. `Spicetify.Platform` exposes internal Spotify client APIs, and Spicetify explicitly warns that those APIs can vary by Spotify version.

Track Mirror therefore starts with a conservative discovery adapter rather than depending on an undocumented endpoint.

## What the adapter does

`spicetify/track-mirror-friend-activity.js` runs inside the Spotify desktop client and:

- watches the rendered Friend Activity area with `MutationObserver`;
- looks for friend/user and track links already rendered by Spotify;
- extracts friend, track, artist and context metadata when present;
- emits observations as a browser event named `track-mirror:friend-activity`;
- writes the most recent observations to local storage under `track-mirror:last-observations`;
- exposes `window.TrackMirrorFriendActivity.scan()` and `getLastObservations()` for manual testing.

This is DOM extraction, not OCR, and does not inspect or copy audio data.

## Testing while friends are inactive

The adapter can still be installed and verified when nobody is actively listening. Open Friend Activity, then in Spotify DevTools run:

```js
TrackMirrorFriendActivity.scan()
```

and:

```js
TrackMirrorFriendActivity.getLastObservations()
```

If Spotify is rendering stale/recent friend rows, the adapter may return them. If the panel is empty, an empty array is the expected result and confirms that the extension loaded without fabricating data.

When a friend becomes active, repeat the scan and inspect the emitted object. That live sample will tell us whether the current Spotify build provides stable link structure and whether any selector refinements are needed.

## Installation on Linux

Copy or symlink the extension into the Spicetify extensions directory, normally:

```text
~/.config/spicetify/Extensions/
```

Then enable it:

```bash
spicetify config extensions track-mirror-friend-activity.js
spicetify apply
```

Open Spotify DevTools with `Ctrl+Shift+I` and search the console for `[Track Mirror]`.

## Next step

Once we have one real Friend Activity sample, freeze the smallest reliable DOM contract we can find and connect observations to Track Mirror's normalized `PlaybackState` source interface. If a cleaner internal client API is discovered later, it can replace this adapter without changing the rest of the application.
