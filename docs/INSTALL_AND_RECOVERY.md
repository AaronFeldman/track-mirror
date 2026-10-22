# Track Mirror installation and recovery design

Track Mirror must be removable without requiring a Spotify reinstall.

## Safety model

The installer follows this order:

1. Detect Spicetify and its configured Spotify path.
2. Refuse to continue if the configured Spotify installation cannot be found.
3. Create a timestamped Track Mirror recovery directory.
4. Record the Spicetify version, Spotify path and preferences path.
5. Preserve any pre-existing Track Mirror extension file.
6. Preserve the user's Spicetify configuration file when present.
7. Ask Spicetify to create its own vanilla Spotify backup.
8. Install and enable the Track Mirror extension.
9. Apply Spicetify.
10. If apply fails, immediately attempt `spicetify restore` and remove/restore the extension file.
11. Only after a successful apply, write the Track Mirror install manifest.

The manifest lives by default at:

`~/.local/state/track-mirror/install-manifest.txt`

Timestamped recovery material lives under:

`~/.local/state/track-mirror/backups/`

## Restore behavior

`scripts/restore-spotify.sh`:

- runs `spicetify restore`;
- removes Track Mirror's extension, or restores the file that existed before installation;
- restores the pre-install Spicetify configuration snapshot when one exists;
- removes the active Track Mirror installation manifest;
- deliberately retains recovery snapshots until the user chooses to delete them.

## Important boundary

Track Mirror does not distribute Spotify binaries. The user supplies their own Spotify installation. Track Mirror distributes its own code and automates local installation/removal through Spicetify.

## Development rule

Do not add a new patching step unless the rollback path is updated in the same change. Every file Track Mirror creates or modifies should either be recorded in the manifest/recovery snapshot or be safely reproducible/removable.

## Planned improvements before general release

- Add a `--dry-run` mode.
- Add explicit Spotify process detection and refuse patching while Spotify is running unless known safe.
- Add checksum recording for files Track Mirror owns.
- Add a post-install health check confirming Spotify launches and the Track Mirror extension initializes.
- Add automatic rollback when the health check fails.
- Add version compatibility gates for Spotify and Spicetify.
- Add a user-facing `track-mirror doctor` command.
- Add automated shell tests using a temporary fake Spicetify environment.
