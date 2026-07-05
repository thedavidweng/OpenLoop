use tauri::State;

use crate::{
    models::{
        errors::AppResult,
        profile::{CreateProfileRequest, GenerationProfile, RenameProfileRequest},
    },
    AppState,
};

#[tauri::command]
pub fn list_profiles(state: State<'_, AppState>) -> AppResult<Vec<GenerationProfile>> {
    state.db.list_profiles()
}

#[tauri::command]
pub fn create_profile(
    state: State<'_, AppState>,
    request: CreateProfileRequest,
) -> AppResult<GenerationProfile> {
    state.db.create_profile(&request)
}

#[tauri::command]
pub fn rename_profile(
    state: State<'_, AppState>,
    id: String,
    request: RenameProfileRequest,
) -> AppResult<GenerationProfile> {
    state.db.rename_profile(&id, &request.name)
}

#[tauri::command]
pub fn delete_profile(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.db.delete_profile(&id)
}
