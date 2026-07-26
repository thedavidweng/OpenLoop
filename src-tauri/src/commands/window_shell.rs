use tauri::State;

use crate::models::errors::{AppError, AppResult};

#[tauri::command]
pub fn get_window_shell_state(
    state: State<'_, crate::window_shell::WindowShellState>,
) -> crate::window_shell::WindowShellState {
    state.inner().clone()
}

#[tauri::command]
pub fn window_ready(window: tauri::WebviewWindow) -> AppResult<()> {
    // The main window starts hidden so users never see the WebView's default
    // empty frame. Frontend calls this only after the first real app screen commits.
    window
        .show()
        .map_err(|error| AppError::new("WINDOW_SHOW_FAILED", error.to_string(), None, true))
}
