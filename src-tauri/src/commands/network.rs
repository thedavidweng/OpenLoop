use tauri::State;

use crate::{services::network_log::NetworkEntry, AppState};

/// Return the most recent network activity entries (newest first).
#[tauri::command]
pub fn get_network_log(state: State<'_, AppState>, limit: Option<usize>) -> Vec<NetworkEntry> {
    state.network_log.recent(limit.unwrap_or(100))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::network_log::{NetworkActivityLog, NetworkEntry};
    use chrono::Utc;
    use std::sync::Arc;

    #[test]
    fn get_network_log_returns_entries_from_state() {
        let log = Arc::new(NetworkActivityLog::new());
        log.push(NetworkEntry {
            timestamp: Utc::now(),
            url: "https://example.com/test".to_owned(),
            method: "GET".to_owned(),
            status: 200,
        });

        let entries = log.recent(10);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].url, "https://example.com/test");
        assert_eq!(entries[0].status, 200);
    }

    #[test]
    fn get_network_log_respects_limit_parameter() {
        let log = Arc::new(NetworkActivityLog::new());
        for i in 0..10 {
            log.push(NetworkEntry {
                timestamp: Utc::now(),
                url: format!("https://example.com/{i}"),
                method: "GET".to_owned(),
                status: 200,
            });
        }

        let entries = log.recent(5);
        assert_eq!(entries.len(), 5);
        assert_eq!(entries[0].url, "https://example.com/9");
    }
}
