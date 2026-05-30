use tauri::{AppHandle, State};

use crate::{
    app_state::AppState,
    models::errors::AppResult,
    services::backend_provisioner::BackendProvisionStatus,
};

#[tauri::command]
pub fn get_backend_provision_status(
    state: State<'_, AppState>,
) -> AppResult<BackendProvisionStatus> {
    let provisioner = state
        .provisioner
        .lock()
        .map_err(|e| crate::models::errors::AppError::internal(e.to_string()))?;
    Ok(provisioner.status())
}

#[tauri::command]
pub fn provision_backend(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<BackendProvisionStatus> {
    let provisioner = state
        .provisioner
        .lock()
        .map_err(|e| crate::models::errors::AppError::internal(e.to_string()))?;
    provisioner.provision(app)?;
    Ok(provisioner.status())
}

#[tauri::command]
pub fn check_backend_updates(
    state: State<'_, AppState>,
) -> AppResult<BackendProvisionStatus> {
    let provisioner = state
        .provisioner
        .lock()
        .map_err(|e| crate::models::errors::AppError::internal(e.to_string()))?;
    provisioner.check_for_updates()
}

#[tauri::command]
pub fn update_backend(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<BackendProvisionStatus> {
    let provisioner = state
        .provisioner
        .lock()
        .map_err(|e| crate::models::errors::AppError::internal(e.to_string()))?;
    provisioner.update(app)?;
    Ok(provisioner.status())
}
