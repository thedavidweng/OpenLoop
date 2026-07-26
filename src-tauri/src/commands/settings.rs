use serde_json::Value;
use std::path::Path;
use tauri::State;

use crate::{
    models::{
        errors::{AppError, AppResult},
        settings::AppSettings,
    },
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
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    key: String,
    value: Value,
) -> AppResult<AppSettings> {
    let settings = state.db.set_setting(&key, value)?;

    // A newly chosen output directory must be reachable by the asset protocol
    // or playback of anything generated into it fails with a scope denial.
    if key == "outputDirectory" {
        if let Some(dir) = settings.output_directory.as_deref() {
            use tauri::Manager;
            if let Err(error) = app.asset_protocol_scope().allow_directory(dir, true) {
                tracing::warn!("failed to extend asset scope to output directory {dir}: {error}");
            }
        }
    }

    Ok(settings)
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

#[tauri::command]
pub fn add_cli_to_path() -> AppResult<String> {
    let target = Path::new("/usr/local/bin/openloop");
    if let Some(parent) = target.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|error| {
                AppError::internal(format!(
                    "Cannot create /usr/local/bin. Grant permission in System Settings, then retry. ({error})"
                ))
            })?;
        }
    }

    let exe_path = std::env::current_exe().map_err(|error| {
        AppError::internal(format!("Cannot locate current executable: {error}"))
    })?;

    if target.exists() {
        let _ = std::fs::remove_file(target);
    }

    #[cfg(target_os = "macos")]
    std::os::unix::fs::symlink(&exe_path, target)
        .map_err(|error| AppError::internal(format!("Cannot create symlink: {error}")))?;

    Ok("openloop added to PATH".to_owned())
}

#[tauri::command]
pub fn remove_cli_from_path() -> AppResult<String> {
    let target = Path::new("/usr/local/bin/openloop");
    if target.exists() {
        let _ = std::fs::remove_file(target);
    }
    Ok("Removed from PATH".to_owned())
}

#[tauri::command]
pub fn is_cli_in_path() -> AppResult<bool> {
    Ok(Path::new("/usr/local/bin/openloop").exists())
}
