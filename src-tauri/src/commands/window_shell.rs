use tauri::State;

#[tauri::command]
pub fn get_window_shell_state(
    state: State<'_, crate::window_shell::WindowShellState>,
) -> crate::window_shell::WindowShellState {
    state.inner().clone()
}
