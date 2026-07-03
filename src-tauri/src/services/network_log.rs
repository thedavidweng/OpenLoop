use std::sync::Mutex;

use chrono::{DateTime, Utc};
use serde::Serialize;

/// A single outbound network request record.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkEntry {
    pub timestamp: DateTime<Utc>,
    pub url: String,
    pub method: String,
    pub status: u16,
}

/// Session-scoped log of all outbound HTTP activity.
///
/// Stored as Tauri state so the frontend can query it. Bounded to
/// [`MAX_ENTRIES`] entries; oldest entries are dropped once the cap is reached.
#[derive(Debug)]
pub struct NetworkActivityLog {
    entries: Mutex<Vec<NetworkEntry>>,
}

/// Maximum number of entries retained in the log.
const MAX_ENTRIES: usize = 1_000;

impl NetworkActivityLog {
    pub fn new() -> Self {
        Self {
            entries: Mutex::new(Vec::new()),
        }
    }

    /// Record a completed network request with explicit fields.
    pub fn push(&self, entry: NetworkEntry) {
        if let Ok(mut guard) = self.entries.lock() {
            guard.push(entry);
            if guard.len() > MAX_ENTRIES {
                let overflow = guard.len() - MAX_ENTRIES;
                guard.drain(..overflow);
            }
        }
    }

    /// Convenience: record a request by its URL, HTTP method, and status code.
    pub fn record(&self, url: &str, method: &str, status: u16) {
        self.push(NetworkEntry {
            timestamp: Utc::now(),
            url: url.to_owned(),
            method: method.to_owned(),
            status,
        });
    }

    /// Return the most recent entries, newest first.
    pub fn recent(&self, limit: usize) -> Vec<NetworkEntry> {
        if let Ok(guard) = self.entries.lock() {
            let len = guard.len();
            let start = len.saturating_sub(limit);
            guard[start..].iter().rev().cloned().collect()
        } else {
            Vec::new()
        }
    }

    /// Total number of entries ever recorded.
    pub fn len(&self) -> usize {
        self.entries.lock().map(|g| g.len()).unwrap_or(0)
    }

    /// Whether the log has recorded any entries.
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

impl Default for NetworkActivityLog {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_and_recent_returns_entries_newest_first() {
        let log = NetworkActivityLog::new();

        log.push(NetworkEntry {
            timestamp: Utc::now(),
            url: "https://example.com/first".to_owned(),
            method: "GET".to_owned(),
            status: 200,
        });
        log.push(NetworkEntry {
            timestamp: Utc::now(),
            url: "https://example.com/second".to_owned(),
            method: "POST".to_owned(),
            status: 201,
        });

        let entries = log.recent(10);
        assert_eq!(entries.len(), 2);
        // Newest first
        assert_eq!(entries[0].url, "https://example.com/second");
        assert_eq!(entries[1].url, "https://example.com/first");
    }

    #[test]
    fn recent_respects_limit() {
        let log = NetworkActivityLog::new();

        for i in 0..5 {
            log.push(NetworkEntry {
                timestamp: Utc::now(),
                url: format!("https://example.com/{i}"),
                method: "GET".to_owned(),
                status: 200,
            });
        }

        let entries = log.recent(3);
        assert_eq!(entries.len(), 3);
        // Should be the last 3, newest first
        assert_eq!(entries[0].url, "https://example.com/4");
        assert_eq!(entries[1].url, "https://example.com/3");
        assert_eq!(entries[2].url, "https://example.com/2");
    }

    #[test]
    fn recent_returns_empty_on_empty_log() {
        let log = NetworkActivityLog::new();
        let entries = log.recent(10);
        assert!(entries.is_empty());
    }

    #[test]
    fn record_creates_entry_with_current_timestamp() {
        let log = NetworkActivityLog::new();
        log.record("https://example.com/api", "GET", 200);

        assert_eq!(log.len(), 1);
        let entries = log.recent(1);
        assert_eq!(entries[0].url, "https://example.com/api");
        assert_eq!(entries[0].method, "GET");
        assert_eq!(entries[0].status, 200);
    }
}
