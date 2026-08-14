use tauri::{AppHandle, State};

use crate::{
    models::{errors::AppResult, settings::ModelVariant},
    services::{
        model_catalog::{self, ModelRegistry},
        model_manager::{AceModelDescriptor, ModelStatusSnapshot, ACE_MODEL_DESCRIPTORS},
    },
    AppState,
};

#[tauri::command]
pub fn list_model_catalog() -> Vec<AceModelDescriptor> {
    ACE_MODEL_DESCRIPTORS.to_vec()
}

#[tauri::command]
pub fn list_model_registry() -> ModelRegistry {
    model_catalog::registry()
}

#[tauri::command]
pub fn get_model_status(state: State<'_, AppState>) -> AppResult<Vec<ModelStatusSnapshot>> {
    let settings = state.db.get_settings()?;
    let manager = state
        .models
        .lock()
        .map_err(|_| crate::models::errors::AppError::internal("model manager lock poisoned"))?;
    Ok(manager.refresh(&settings))
}

#[tauri::command]
pub fn download_model(
    app: AppHandle,
    state: State<'_, AppState>,
    variant: ModelVariant,
) -> AppResult<ModelStatusSnapshot> {
    let settings = state.db.get_settings()?;
    let manager = state
        .models
        .lock()
        .map_err(|_| crate::models::errors::AppError::internal("model manager lock poisoned"))?;
    manager.download(app, settings, variant)
}

#[tauri::command]
pub fn delete_model(
    app: AppHandle,
    state: State<'_, AppState>,
    variant: ModelVariant,
) -> AppResult<ModelStatusSnapshot> {
    let settings = state.db.get_settings()?;
    let manager = state
        .models
        .lock()
        .map_err(|_| crate::models::errors::AppError::internal("model manager lock poisoned"))?;
    manager.delete(app, settings, variant)
}

#[tauri::command]
pub fn clear_partial_downloads(
    state: State<'_, AppState>,
    variant: ModelVariant,
) -> AppResult<ModelStatusSnapshot> {
    let settings = state.db.get_settings()?;
    let manager = state
        .models
        .lock()
        .map_err(|_| crate::models::errors::AppError::internal("model manager lock poisoned"))?;
    manager.clear_partial_downloads(&settings, variant)
}

#[tauri::command]
pub fn cancel_download(state: State<'_, AppState>, variant: ModelVariant) -> AppResult<()> {
    let manager = state
        .models
        .lock()
        .map_err(|_| crate::models::errors::AppError::internal("model manager lock poisoned"))?;
    manager.cancel_download(variant)
}

#[tauri::command]
pub fn delete_all_models(state: State<'_, AppState>) -> AppResult<Vec<ModelStatusSnapshot>> {
    let settings = state.db.get_settings()?;
    let manager = state
        .models
        .lock()
        .map_err(|_| crate::models::errors::AppError::internal("model manager lock poisoned"))?;
    Ok(manager.delete_all(&settings))
}
