use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

#[cfg(desktop)]
mod desktop;
mod error;
#[cfg(mobile)]
mod mobile;
mod models;

#[cfg(desktop)]
pub use desktop::SpotifyPlayback;
pub use error::{Error, Result};
#[cfg(mobile)]
pub use mobile::SpotifyPlayback;
pub use models::*;

/// Access the Track Mirror Spotify playback adapter managed by Tauri.
pub trait SpotifyPlaybackExt<R: Runtime> {
    fn spotify_playback(&self) -> &SpotifyPlayback<R>;
}

impl<R: Runtime, T: Manager<R>> SpotifyPlaybackExt<R> for T {
    fn spotify_playback(&self) -> &SpotifyPlayback<R> {
        self.state::<SpotifyPlayback<R>>().inner()
    }
}

/// Initialize the platform-specific Spotify playback adapter.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("spotify-playback")
        .setup(|app, api| {
            #[cfg(mobile)]
            let spotify_playback = mobile::init(app, api)?;
            #[cfg(desktop)]
            let spotify_playback = desktop::init(app, api)?;
            app.manage(spotify_playback);
            Ok(())
        })
        .build()
}
