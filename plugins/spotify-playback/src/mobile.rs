use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{
    AuthorizationCallbackRequest, ConfigureRequest, PlayTrackRequest, PlaybackResponse, Result,
};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.trackmirror.spotify";

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_spotify_playback);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<SpotifyPlayback<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "SpotifyPlaybackPlugin")?;

    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_spotify_playback)?;

    Ok(SpotifyPlayback(handle))
}

/// Native Spotify playback bridge for Android and iOS.
pub struct SpotifyPlayback<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> SpotifyPlayback<R> {
    pub fn configure(&self, client_id: String, redirect_uri: String) -> Result<PlaybackResponse> {
        self.0
            .run_mobile_plugin(
                "configure",
                ConfigureRequest {
                    client_id,
                    redirect_uri,
                },
            )
            .map_err(Into::into)
    }

    pub fn connect(&self) -> Result<PlaybackResponse> {
        self.0
            .run_mobile_plugin("connect", ())
            .map_err(Into::into)
    }

    pub fn play_track(&self, track_uri: String) -> Result<PlaybackResponse> {
        self.0
            .run_mobile_plugin("playTrack", PlayTrackRequest { track_uri })
            .map_err(Into::into)
    }

    pub fn pause(&self) -> Result<PlaybackResponse> {
        self.0
            .run_mobile_plugin("pause", ())
            .map_err(Into::into)
    }

    pub fn disconnect(&self) -> Result<PlaybackResponse> {
        self.0
            .run_mobile_plugin("disconnect", ())
            .map_err(Into::into)
    }

    pub fn handle_authorization_callback(&self, url: String) -> Result<PlaybackResponse> {
        self.0
            .run_mobile_plugin(
                "handleAuthorizationCallback",
                AuthorizationCallbackRequest { url },
            )
            .map_err(Into::into)
    }
}
