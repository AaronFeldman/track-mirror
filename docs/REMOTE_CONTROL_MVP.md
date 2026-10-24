# Track Mirror phone remote control MVP

Status: implementation milestone, October 24, 2026

## Purpose

This is the deliberately fast mobile-control path requested before the full Android application. The desktop remains the authoritative Track Mirror host. A phone acts only as a lightweight remote for choosing the active source listener or stopping mirroring.

The bridge carries Track Mirror control/state metadata only. It does not carry Spotify audio.

## Current flow

```text
Android phone browser
  -> local-network Track Mirror control server
  -> loopback command queue
  -> Spicetify Track Mirror remote bridge
  -> existing TrackMirrorPlayback controls
  -> selected friend / mirroring ON-OFF
```

The reverse state path reports the currently visible Listening Activity friend list, selected friend, and mirroring state back to the phone.

## Phone controls

The first UI intentionally stays small:

- show whether following is ON or OFF;
- show the currently followed friend;
- list the friends currently detected by desktop Listening Activity;
- tap a friend to switch to that friend and turn following on;
- tap **Stop following** to turn following off.

The server owns the remote command state, while the Spotify desktop/Spicetify implementation remains authoritative for actual mirroring behavior.

## Pairing and local-network security

The control server binds to the desktop LAN on port `8765`. It generates a random pairing token at:

`~/.config/track-mirror/remote-token`

LAN control requests require that token. The page removes a token supplied in the pairing URL from the visible URL after storing it locally on the phone.

The Spicetify bridge endpoints are loopback-only. Cross-origin access is limited to the Spotify desktop web origin used by the extension bridge.

## Installation / first use

From the repository, install/update both the Spicetify pieces and desktop launcher:

```bash
scripts/install-track-mirror.sh
scripts/install-desktop-launcher.sh
```

Start **Track Mirror** from the desktop application launcher. The launcher starts the remote-control server automatically.

Then run:

```bash
track-mirror-remote-info
```

Open the displayed local-network URL on the Android phone while the phone and desktop are on the same network.

## Transitional status

This bridge is intentionally attached to the working Spicetify proof of concept so remote control becomes usable before the full native Android application is complete. It should later be replaced behind the same product semantics by the canonical Rust/Tauri host transport rather than becoming permanent product logic.
