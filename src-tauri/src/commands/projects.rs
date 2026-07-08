use tauri::State;

use crate::{
    models::{
        errors::AppResult,
        project::{CreateProjectRequest, Project, RenameProjectRequest},
    },
    AppState,
};

#[tauri::command]
pub fn list_projects(state: State<'_, AppState>) -> AppResult<Vec<Project>> {
    state.db.list_projects()
}

#[tauri::command]
pub fn create_project(
    state: State<'_, AppState>,
    request: CreateProjectRequest,
) -> AppResult<Project> {
    state.db.create_project(&request.name)
}

#[tauri::command]
pub fn rename_project(
    state: State<'_, AppState>,
    id: String,
    request: RenameProjectRequest,
) -> AppResult<Project> {
    state.db.rename_project(&id, &request.name)
}

#[tauri::command]
pub fn delete_project(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.db.delete_project(&id)
}

#[tauri::command]
pub fn assign_generation_to_project(
    state: State<'_, AppState>,
    generation_id: String,
    project_id: Option<String>,
) -> AppResult<()> {
    state
        .db
        .set_generation_project(&generation_id, project_id.as_deref())
}
