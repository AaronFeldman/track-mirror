use serde::de::DeserializeOwned;
use std::process::Command;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::{Error, PlaybackResponse, Result};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> Result<SpotifyPlayback<R>> {
    Ok(SpotifyPlayback(app.clone()))
}

pub struct SpotifyPlayback<R: Runtime>(#[allow(dead_code)] AppHandle<R>);

impl<R: Runtime> SpotifyPlayback<R> {
    fn ok(message: impl Into<String>) -> Result<PlaybackResponse> {
        Ok(PlaybackResponse {
            ok: true,
            connected: true,
            message: Some(message.into()),
        })
    }

    pub fn configure(&self, _client_id: String, _redirect_uri: String) -> Result<PlaybackResponse> {
        Self::ok("desktop playback uses the locally installed Spotify client")
    }

    pub fn connect(&self) -> Result<PlaybackResponse> {
        Self::ok("desktop Spotify adapter ready")
    }

    pub fn play_track(&self, track_uri: String) -> Result<PlaybackResponse> {
        if !track_uri.starts_with("spotify:track:") {
            return Err(Error::DesktopCommand(
                "refusing non-track Spotify URI".to_string(),
            ));
        }

        #[cfg(target_os = "macos")]
        {
            let script = format!(
                "tell application \"Spotify\" to play track \"{}\"",
                track_uri.replace('"', "")
            );
            let status = Command::new("osascript")
                .arg("-e")
                .arg(script)
                .status()
                .map_err(|error| Error::DesktopCommand(error.to_string()))?;
            if !status.success() {
                return Err(Error::DesktopCommand(format!(
                    "osascript exited with status {status}"
                )));
            }
            return Self::ok(format!("playing {track_uri} through Spotify"));
        }

        #[cfg(target_os = "windows")]
        {
            let status = Command::new("cmd")
                .args(["/C", "start", "", &track_uri])
                .status()
                .map_err(|error| Error::DesktopCommand(error.to_string()))?;
            if !status.success() {
                return Err(Error::DesktopCommand(format!(
                    "Windows URI launch exited with status {status}"
                )));
            }
            return Self::ok(format!("opened {track_uri} in Spotify"));
        }

        #[cfg(target_os = "linux")]
        {
            let status = Command::new("xdg-open")
                .arg(&track_uri)
                .status()
                .map_err(|error| Error::DesktopCommand(error.to_string()))?;
            if !status.success() {
                return Err(Error::DesktopCommand(format!(
                    "xdg-open exited with status {status}"
                )));
            }
            return Self::ok(format!("opened {track_uri} in Spotify"));
        }

        #[allow(unreachable_code)]
        Err(Error::UnsupportedPlatform)
    }

    pub fn pause(&self) -> Result<PlaybackResponse> {
        #[cfg(target_os = "macos")]
        {
            let status = Command::new("osascript")
                .args(["-e", "tell application \"Spotify\" to pause"])
                .status()
                .map_err(|error| Error::DesktopCommand(error.to_string()))?;
            if !status.success() {
                return Err(Error::DesktopCommand(format!(
                    "osascript exited with status {status}"
                )));
            }
            return Self::ok("Spotify paused");
        }

        #[cfg(any(target_os = "windows", target_os = "linux"))]
        {
            return Ok(PlaybackResponse {
                ok: false,
                connected: true,
                message: Some(
                    "pause is not yet implemented for this desktop platform; track changes are supported"
                        .to_string(),
                ),
            });
        }

        #[allow(unreachable_code)]
        Err(Error::UnsupportedPlatform)
    }

    pub fn disconnect(&self) -> Result<PlaybackResponse> {
        Ok(PlaybackResponse {
            ok: true,
            connected: false,
            message: Some("desktop adapter disconnected".to_string()),
        })
    }

    pub fn handle_authorization_callback(&self, _url: String) -> Result<PlaybackResponse> {
        Err(Error::UnsupportedPlatform)
    }
}
