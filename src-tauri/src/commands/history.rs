use tauri::State;

use crate::{
    models::{errors::AppResult, generation::GenerationRecord},
    AppState,
};

#[tauri::command]
pub fn list_generations(
    state: State<'_, AppState>,
    query: Option<String>,
) -> AppResult<Vec<GenerationRecord>> {
    state.db.list_generations(query.as_deref())
}

#[tauri::command]
pub fn get_generation(
    state: State<'_, AppState>,
    id: String,
) -> AppResult<Option<GenerationRecord>> {
    state.db.get_generation(&id)
}

#[tauri::command]
pub fn delete_generation(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.db.delete_generation(&id)
}
