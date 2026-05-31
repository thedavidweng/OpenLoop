use tauri::State;

use crate::{
    models::{
        errors::AppResult,
        generation::{FailedRun, GenerationRecord},
    },
    services::history::HistoryService,
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

#[tauri::command]
pub fn clear_generation_history(state: State<'_, AppState>) -> AppResult<()> {
    HistoryService::new(state.db.clone()).clear_generation_history()
}

#[tauri::command]
pub fn toggle_generation_favorite(state: State<'_, AppState>, id: String) -> AppResult<bool> {
    let record = state
        .db
        .get_generation(&id)?
        .ok_or_else(|| crate::models::errors::AppError::not_found("Generation record", id))?;
    let new_state = !record.is_favorite;
    state.db.set_generation_favorite(&record.id, new_state)?;
    Ok(new_state)
}

#[tauri::command]
pub fn list_failed_runs(state: State<'_, AppState>, limit: usize) -> AppResult<Vec<FailedRun>> {
    state.db.list_failed_runs(limit)
}

#[tauri::command]
pub fn clear_failed_runs(state: State<'_, AppState>) -> AppResult<()> {
    state.db.clear_failed_runs_older_than(0)
}

#[tauri::command]
pub fn delete_failed_run(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.db.delete_failed_run(&id)
}
