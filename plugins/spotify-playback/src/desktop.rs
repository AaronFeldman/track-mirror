use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::{Error, PlaybackResponse, Result};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> Result<SpotifyPlayback<R>> {
    Ok(SpotifyPlayback(app.clone()))
}

/// Desktop placeholder. Desktop Spotify integration remains a separate adapter.
pub struct SpotifyPlayback<R: Runtime>(#[allow(dead_code)] AppHandle<R>);

impl<R: Runtime> SpotifyPlayback<R> {
    fn unsupported(&self) -> Result<PlaybackResponse> {
        Err(Error::UnsupportedPlatform)
    }

    pub fn configure(&self, _client_id: String, _redirect_uri: String) -> Result<PlaybackResponse> {
        self.unsupported()
    }

    pub fn connect(&self) -> Result<PlaybackResponse> {
        self.unsupported()
    }

    pub fn play_track(&self, _track_uri: String) -> Result<PlaybackResponse> {
        self.unsupported()
    }

    pub fn pause(&self) -> Result<PlaybackResponse> {
        self.unsupported()
    }

    pub fn disconnect(&self) -> Result<PlaybackResponse> {
        self.unsupported()
    }

    pub fn handle_authorization_callback(&self, _url: String) -> Result<PlaybackResponse> {
        self.unsupported()
    }
}
