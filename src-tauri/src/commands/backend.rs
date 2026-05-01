use std::fs;

use tauri::State;

use crate::{
    models::{backend::BackendStatus, errors::AppResult},
    services::model_bootstrap::runtime_dir_for,
    AppState,
};

#[tauri::command]
pub fn backend_status(state: State<'_, AppState>) -> AppResult<BackendStatus> {
    let mut manager = state
        .backend
        .lock()
        .map_err(|_| crate::models::errors::AppError::internal("backend manager lock poisoned"))?;
    Ok(manager.status())
}

#[tauri::command]
pub fn start_backend(state: State<'_, AppState>) -> AppResult<BackendStatus> {
    let settings = state.db.get_settings()?;
    let mut manager = state
        .backend
        .lock()
        .map_err(|_| crate::models::errors::AppError::internal("backend manager lock poisoned"))?;
    manager.start(&settings)
}

#[tauri::command]
pub fn stop_backend(state: State<'_, AppState>) -> AppResult<BackendStatus> {
    let mut manager = state
        .backend
        .lock()
        .map_err(|_| crate::models::errors::AppError::internal("backend manager lock poisoned"))?;
    manager.stop()
}

#[tauri::command]
pub fn restart_backend(state: State<'_, AppState>) -> AppResult<BackendStatus> {
    let settings = state.db.get_settings()?;
    let mut manager = state
        .backend
        .lock()
        .map_err(|_| crate::models::errors::AppError::internal("backend manager lock poisoned"))?;
    manager.restart(&settings)
}

#[tauri::command]
pub fn get_backend_logs_path(state: State<'_, AppState>) -> AppResult<Option<String>> {
    let manager = state
        .backend
        .lock()
        .map_err(|_| crate::models::errors::AppError::internal("backend manager lock poisoned"))?;
    Ok(manager.logs_path())
}

#[tauri::command]
pub fn clear_backend_cache(state: State<'_, AppState>) -> AppResult<()> {
    let settings = state.db.get_settings()?;
    {
        let mut manager = state.backend.lock().map_err(|_| {
            crate::models::errors::AppError::internal("backend manager lock poisoned")
        })?;
        manager.stop()?;
    }

    let cache_dir = runtime_dir_for(&state.app_data_dir, &settings).join(".cache");
    if cache_dir.exists() {
        fs::remove_dir_all(&cache_dir)
            .map_err(|error| crate::models::errors::AppError::internal(error.to_string()))?;
    }

    Ok(())
}
