use tauri::State;

use crate::{
    services::observability::{read_app_logs, AppLogEntry},
    AppState,
};

/// Return recent app log entries (newest-first), optionally filtered by minimum
/// severity level (`trace`, `debug`, `info`, `warn`, `error`).
#[tauri::command]
pub fn get_app_logs(
    state: State<'_, AppState>,
    min_level: Option<String>,
    limit: Option<usize>,
) -> Vec<AppLogEntry> {
    read_app_logs(&state.app_data_dir, min_level.as_deref(), limit)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn get_app_logs_reads_from_app_data_dir() {
        let dir = tempfile::tempdir().expect("temp dir");
        let log_dir = dir.path().join("logs").join("app");
        fs::create_dir_all(&log_dir).expect("create log dir");
        let line = serde_json::json!({
            "timestamp": "2026-07-04T12:00:00Z",
            "level": "info",
            "target": "test",
            "fields": { "message": "hello" }
        })
        .to_string();
        fs::write(
            log_dir.join("openloop-20260704T120000.log"),
            format!("{line}\n"),
        )
        .expect("write log");

        let entries = read_app_logs(dir.path(), None, None);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].level, "info");
    }
}
