use serde_json::Value;
use tauri::State;

use crate::{
    models::{errors::AppResult, settings::AppSettings},
    AppState,
};

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultAppPaths {
    pub output_directory: String,
    pub model_directory: String,
    pub log_directory: String,
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> AppResult<AppSettings> {
    state.db.get_settings()
}

#[tauri::command]
pub fn set_setting(
    state: State<'_, AppState>,
    key: String,
    value: Value,
) -> AppResult<AppSettings> {
    state.db.set_setting(&key, value)
}

#[tauri::command]
pub fn reset_runtime_settings(state: State<'_, AppState>) -> AppResult<AppSettings> {
    let resets = [
        ("backendPort", Value::from(8001)),
        ("modelDirectory", Value::Null),
        ("backendWorkingDirectory", Value::Null),
        ("logDirectory", Value::Null),
    ];

    for (key, value) in resets {
        state.db.set_setting(key, value)?;
    }

    state.db.get_settings()
}

#[tauri::command]
pub fn get_default_app_paths(state: State<'_, AppState>) -> AppResult<DefaultAppPaths> {
    let app_data_dir = &state.app_data_dir;
    let output_directory = std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .map(|home| home.join("Music").join("OpenLoop"))
        .unwrap_or_else(|| app_data_dir.join("generated-audio"));

    Ok(DefaultAppPaths {
        output_directory: output_directory.display().to_string(),
        model_directory: app_data_dir
            .join("models")
            .join("checkpoints")
            .display()
            .to_string(),
        log_directory: app_data_dir
            .join("logs")
            .join("backend")
            .display()
            .to_string(),
    })
}
