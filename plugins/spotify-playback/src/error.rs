pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[cfg(mobile)]
    #[error(transparent)]
    PluginInvoke(#[from] tauri::plugin::mobile::PluginInvokeError),

    #[error("Spotify playback adapter is unavailable on this platform")]
    UnsupportedPlatform,

    #[cfg(desktop)]
    #[error("Spotify desktop playback command failed: {0}")]
    DesktopCommand(String),
}
