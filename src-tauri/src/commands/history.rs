use tauri::State;

use crate::{
    models::{errors::AppResult, generation::GenerationRecord},
    services::history::HistoryService,
    AppState,
};

#[tauri::command]
pub fn list_generations(
    state: State<'_, AppState>,
    query: Option<String>,
) -> AppResult<Vec<GenerationRecord>> {
    HistoryService::new(state.db.clone()).list_generations(query.as_deref())
}

#[tauri::command]
pub fn get_generation(
    state: State<'_, AppState>,
    id: String,
) -> AppResult<Option<GenerationRecord>> {
    HistoryService::new(state.db.clone()).get_generation(&id)
}

#[tauri::command]
pub fn delete_generation(state: State<'_, AppState>, id: String) -> AppResult<()> {
    HistoryService::new(state.db.clone()).delete_generation(&id)
}

#[tauri::command]
pub fn clear_generation_history(state: State<'_, AppState>) -> AppResult<()> {
    HistoryService::new(state.db.clone()).clear_generation_history()
}
