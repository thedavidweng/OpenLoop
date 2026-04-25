use serde_json::Value;
use tauri::State;

use crate::{
    models::{errors::AppResult, settings::AppSettings},
    AppState,
};

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
