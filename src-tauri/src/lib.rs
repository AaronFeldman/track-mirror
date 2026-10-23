use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_deep_link::DeepLinkExt;
use track_mirror_core::{EngineStatus, MirrorAction, MirrorEngine, MirrorEvent};
use track_mirror_spotify_playback::{
    AndroidMediaSessionResponse, PlaybackResponse, SpotifyPlaybackExt,
};

struct AppState(Mutex<MirrorEngine>);

#[derive(Debug, Serialize)]
struct MirrorApplyResult {
    action: MirrorAction,
    playback: Option<PlaybackResponse>,
}

#[tauri::command]
fn select_listener(listener: String, state: State<'_, AppState>) -> Result<EngineStatus, String> {
    let mut engine = state
        .0
        .lock()
        .map_err(|_| "mirror engine lock poisoned".to_string())?;
    engine.select_listener(listener);
    Ok(engine.status())
}

#[tauri::command]
fn arm_mirroring(state: State<'_, AppState>) -> Result<EngineStatus, String> {
    let mut engine = state
        .0
        .lock()
        .map_err(|_| "mirror engine lock poisoned".to_string())?;
    engine.arm();
    Ok(engine.status())
}

#[tauri::command]
fn disarm_mirroring(state: State<'_, AppState>) -> Result<EngineStatus, String> {
    let mut engine = state
        .0
        .lock()
        .map_err(|_| "mirror engine lock poisoned".to_string())?;
    engine.disarm();
    Ok(engine.status())
}

#[tauri::command]
fn engine_status(state: State<'_, AppState>) -> Result<EngineStatus, String> {
    let engine = state
        .0
        .lock()
        .map_err(|_| "mirror engine lock poisoned".to_string())?;
    Ok(engine.status())
}

#[tauri::command]
fn configure_spotify(
    client_id: String,
    redirect_uri: String,
    app: AppHandle,
) -> Result<PlaybackResponse, String> {
    if !redirect_uri.starts_with("trackmirror://") {
        return Err("Track Mirror mobile Spotify redirect URI must use the registered trackmirror:// scheme".into());
    }

    app.spotify_playback()
        .configure(client_id, redirect_uri)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn connect_spotify(app: AppHandle) -> Result<PlaybackResponse, String> {
    app.spotify_playback()
        .connect()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn disconnect_spotify(app: AppHandle) -> Result<PlaybackResponse, String> {
    app.spotify_playback()
        .disconnect()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn handle_spotify_authorization_callback(
    url: String,
    app: AppHandle,
) -> Result<PlaybackResponse, String> {
    app.spotify_playback()
        .handle_authorization_callback(url)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn android_open_media_control_access(
    app: AppHandle,
) -> Result<AndroidMediaSessionResponse, String> {
    #[cfg(target_os = "android")]
    {
        return app
            .spotify_playback()
            .open_media_control_access_settings()
            .map_err(|error| error.to_string());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("Android MediaSession controls are available only on Android".into())
    }
}

#[tauri::command]
fn android_media_session_status(
    app: AppHandle,
) -> Result<AndroidMediaSessionResponse, String> {
    #[cfg(target_os = "android")]
    {
        return app
            .spotify_playback()
            .media_session_status()
            .map_err(|error| error.to_string());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("Android MediaSession controls are available only on Android".into())
    }
}

#[tauri::command]
fn android_play_track_via_media_session(
    track_uri: String,
    app: AppHandle,
) -> Result<AndroidMediaSessionResponse, String> {
    #[cfg(target_os = "android")]
    {
        return app
            .spotify_playback()
            .play_track_via_media_session(track_uri)
            .map_err(|error| error.to_string());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (track_uri, app);
        Err("Android MediaSession controls are available only on Android".into())
    }
}

#[tauri::command]
fn android_play_track_via_media_session_search(
    track_uri: String,
    app: AppHandle,
) -> Result<AndroidMediaSessionResponse, String> {
    #[cfg(target_os = "android")]
    {
        return app
            .spotify_playback()
            .play_track_via_media_session_search(track_uri)
            .map_err(|error| error.to_string());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (track_uri, app);
        Err("Android MediaSession controls are available only on Android".into())
    }
}

#[tauri::command]
fn android_open_track_via_spotify_link(
    track_uri: String,
    app: AppHandle,
) -> Result<AndroidMediaSessionResponse, String> {
    #[cfg(target_os = "android")]
    {
        return app
            .spotify_playback()
            .open_track_via_spotify_link(track_uri)
            .map_err(|error| error.to_string());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (track_uri, app);
        Err("Android Spotify-link controls are available only on Android".into())
    }
}

#[tauri::command]
fn android_pause_via_media_session(
    app: AppHandle,
) -> Result<AndroidMediaSessionResponse, String> {
    #[cfg(target_os = "android")]
    {
        return app
            .spotify_playback()
            .pause_via_media_session()
            .map_err(|error| error.to_string());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("Android MediaSession controls are available only on Android".into())
    }
}

#[tauri::command]
fn process_mirror_event(
    event: MirrorEvent,
    state: State<'_, AppState>,
) -> Result<MirrorAction, String> {
    let mut engine = state
        .0
        .lock()
        .map_err(|_| "mirror engine lock poisoned".to_string())?;
    engine
        .process_event(&event)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn process_and_apply_mirror_event(
    event: MirrorEvent,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<MirrorApplyResult, String> {
    let action = {
        let mut engine = state
            .0
            .lock()
            .map_err(|_| "mirror engine lock poisoned".to_string())?;
        engine
            .process_event(&event)
            .map_err(|error| error.to_string())?
    };

    #[cfg(mobile)]
    let playback = match &action {
        MirrorAction::PlayTrack { track_uri } => Some(
            app.spotify_playback()
                .play_track(track_uri.clone())
                .map_err(|error| error.to_string())?,
        ),
        MirrorAction::Pause { .. } => Some(
            app.spotify_playback()
                .pause()
                .map_err(|error| error.to_string())?,
        ),
        MirrorAction::Ignored { .. } | MirrorAction::Baseline { .. } => None,
    };

    #[cfg(desktop)]
    let playback = {
        let _ = &app;
        None
    };

    Ok(MirrorApplyResult { action, playback })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(track_mirror_spotify_playback::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(target_os = "ios")]
            {
                // The expected Spotify authorization flow starts in Track Mirror,
                // switches to Spotify, then returns to this already-running app.
                // Route only our registered callback scheme into the native adapter.
                if let Some(urls) = app.deep_link().get_current()? {
                    for url in urls {
                        if url.as_str().starts_with("trackmirror://") {
                            let _ = app
                                .spotify_playback()
                                .handle_authorization_callback(url.to_string());
                        }
                    }
                }

                let app_handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        if url.as_str().starts_with("trackmirror://") {
                            if let Err(error) = app_handle
                                .spotify_playback()
                                .handle_authorization_callback(url.to_string())
                            {
                                eprintln!("Track Mirror Spotify callback failed: {error}");
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .manage(AppState(Mutex::new(MirrorEngine::default())))
        .invoke_handler(tauri::generate_handler![
            select_listener,
            arm_mirroring,
            disarm_mirroring,
            engine_status,
            configure_spotify,
            connect_spotify,
            disconnect_spotify,
            handle_spotify_authorization_callback,
            android_open_media_control_access,
            android_media_session_status,
            android_play_track_via_media_session,
            android_play_track_via_media_session_search,
            android_open_track_via_spotify_link,
            android_pause_via_media_session,
            process_mirror_event,
            process_and_apply_mirror_event
        ])
        .run(tauri::generate_context!())
        .expect("error while running Track Mirror");
}
