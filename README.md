# Track Mirror

Track Mirror is a Spotify companion project for mirroring track identity and playback state between listeners without rebroadcasting Spotify audio. Each listener's own Spotify client performs playback.

## Project principles

- Mirror metadata and playback state, not audio streams.
- Prefer direct client/integration approaches over screen scraping or OCR where feasible.
- Treat OCR as an early proof-of-concept path, not the long-term architecture.
- Keep Spotify platform rules, licensing, and third-party component licenses under active review.
- Preserve a clear development record of product decisions, experiments, and implementation changes.
- Keep platform-specific integrations replaceable so the core design can later support Linux, Windows, macOS, Android, and iOS/iPadOS.

## Current status

The Linux desktop prototype is functionally validated in the current Spotify/Spicetify environment.

The current working path is:

1. detect a friend's Spotify Listening Activity without OCR;
2. extract the displayed track and artist;
3. recover the exact embedded Spotify track URI from the client DOM;
4. let the user select which visible friend to mirror;
5. arm mirroring without immediately playing stale activity;
6. on that friend's next track change, play the corresponding URI in the follower's own Spotify client.

The first successful end-to-end live mirroring test was completed on October 22, 2026.

## Linux desktop launcher

Track Mirror can be registered as a normal desktop application so routine use does not require pasting terminal commands.

From the repository, run once:

```bash
bash scripts/install-desktop-launcher.sh
```

This installs a per-user application entry named **Track Mirror** under `~/.local/share/applications` and a launcher command under `~/.local/bin`. After that, open the system application launcher and select **Track Mirror**. The normal Spotify installation remains separate.

The launcher source files are:

- `scripts/track-mirror-launch.sh`
- `scripts/install-desktop-launcher.sh`
- `desktop/track-mirror.desktop.in`

## Repository guide

- `PROJECT_STATE.md` — canonical current project state.
- `docs/DEVELOPMENT_HISTORY.md` — development and authorship/provenance record.
- `docs/INSTALL_AND_RECOVERY.md` — installation, rollback, and desktop-launcher behavior.
- `docs/ARCHITECTURE.md` — architecture direction.
- `spicetify/` — current desktop discovery, URI, and playback adapters.

Track Mirror does not distribute Spotify binaries. The user supplies their own Spotify installation and Track Mirror applies its own local integration code separately.
