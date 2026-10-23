use std::sync::Mutex;
use tauri::State;
use track_mirror_core::{EngineStatus, MirrorAction, MirrorEngine, MirrorEvent};

struct AppState(Mutex<MirrorEngine>);

#[tauri::command]
fn select_listener(listener: String, state: State<'_, AppState>) -> Result<EngineStatus, String> {
    let mut engine = state.0.lock().map_err(|_| "mirror engine lock poisoned".to_string())?;
    engine.select_listener(listener);
    Ok(engine.status())
}

#[tauri::command]
fn arm_mirroring(state: State<'_, AppState>) -> Result<EngineStatus, String> {
    let mut engine = state.0.lock().map_err(|_| "mirror engine lock poisoned".to_string())?;
    engine.arm();
    Ok(engine.status())
}

#[tauri::command]
fn disarm_mirroring(state: State<'_, AppState>) -> Result<EngineStatus, String> {
    let mut engine = state.0.lock().map_err(|_| "mirror engine lock poisoned".to_string())?;
    engine.disarm();
    Ok(engine.status())
}

#[tauri::command]
fn engine_status(state: State<'_, AppState>) -> Result<EngineStatus, String> {
    let engine = state.0.lock().map_err(|_| "mirror engine lock poisoned".to_string())?;
    Ok(engine.status())
}

#[tauri::command]
fn process_mirror_event(
    event: MirrorEvent,
    state: State<'_, AppState>,
) -> Result<MirrorAction, String> {
    let mut engine = state.0.lock().map_err(|_| "mirror engine lock poisoned".to_string())?;
    engine.process_event(&event).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState(Mutex::new(MirrorEngine::default())))
        .invoke_handler(tauri::generate_handler![
            select_listener,
            arm_mirroring,
            disarm_mirroring,
            engine_status,
            process_mirror_event
        ])
        .run(tauri::generate_context!())
        .expect("error while running Track Mirror");
}
