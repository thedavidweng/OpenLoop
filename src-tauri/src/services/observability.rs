use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::Once,
};

use chrono::Utc;
use serde::Serialize;
use tracing_subscriber::{
    fmt::MakeWriter, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter,
};

/// A single parsed log entry from the app log file.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppLogEntry {
    pub timestamp: String,
    pub level: String,
    pub target: String,
    pub fields: serde_json::Value,
    pub raw: String,
}

/// Read up to `limit` entries from the most recent app log file, optionally
/// filtering by minimum severity level. Returns entries newest-first.
pub fn read_app_logs(
    app_data_dir: &Path,
    min_level: Option<&str>,
    limit: Option<usize>,
) -> Vec<AppLogEntry> {
    let log_dir = app_log_dir(app_data_dir);
    let latest = match latest_app_log(&log_dir) {
        Some(path) => path,
        None => return Vec::new(),
    };

    let content = match fs::read_to_string(&latest) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let level_order = ["trace", "debug", "info", "warn", "error"];
    let min_idx = min_level
        .and_then(|l| level_order.iter().position(|&o| o.eq_ignore_ascii_case(l)))
        .unwrap_or(0);

    let max = limit.unwrap_or(200);
    let mut entries: Vec<AppLogEntry> = content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(parse_log_line)
        .filter(|e| {
            level_order
                .iter()
                .position(|&o| o.eq_ignore_ascii_case(&e.level))
                .is_some_and(|idx| idx >= min_idx)
        })
        .collect();

    entries.reverse();
    entries.truncate(max);
    entries
}

fn latest_app_log(log_dir: &Path) -> Option<PathBuf> {
    let mut entries: Vec<(PathBuf, String)> = Vec::new();
    if let Ok(read_dir) = fs::read_dir(log_dir) {
        for entry in read_dir.flatten() {
            let path = entry.path();
            let name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n.to_owned(),
                None => continue,
            };
            if name.starts_with(APP_LOG_PREFIX) && name.ends_with(APP_LOG_SUFFIX) {
                entries.push((path, name));
            }
        }
    }
    entries.sort_by(|a, b| b.1.cmp(&a.1));
    entries.first().map(|(p, _)| p.clone())
}

fn parse_log_line(line: &str) -> Option<AppLogEntry> {
    let value: serde_json::Value = serde_json::from_str(line).ok()?;
    let timestamp = value
        .get("timestamp")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_owned();
    let level = value
        .get("level")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_owned();
    let target = value
        .get("target")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_owned();
    let fields = value
        .get("fields")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    Some(AppLogEntry {
        timestamp,
        level,
        target,
        fields,
        raw: line.to_owned(),
    })
}

/// Number of historical app log files to keep on disk.
pub const APP_LOG_RETAIN_COUNT: usize = 10;

/// File prefix for rotated app log files: `openloop-YYYYMMDDTHHMMSS.log`.
const APP_LOG_PREFIX: &str = "openloop-";
const APP_LOG_SUFFIX: &str = ".log";

/// Resolve the app log directory under `<app_data_dir>/logs/app`.
pub fn app_log_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("logs").join("app")
}

/// Install a stderr-only tracing subscriber so diagnostic events are captured
/// even when the app data directory is unavailable.
pub fn init_stderr_only() {
    let _ = install_subscriber(AppLogWriter::stderr());
}

/// Initialize structured tracing: JSONL lines written to a timestamped file
/// under `<app_data_dir>/logs/app/`. Falls back to [`init_stderr_only`] when the
/// log directory cannot be created. Old log files beyond [`APP_LOG_RETAIN_COUNT`]
/// are pruned at startup so the directory cannot grow without bound.
///
/// Safe to call once per process; repeated calls are no-ops because the global
/// subscriber is already installed.
pub fn init(app_data_dir: &Path) {
    let log_dir = app_log_dir(app_data_dir);
    if fs::create_dir_all(&log_dir).is_err() {
        init_stderr_only();
        return;
    }

    prune_old_app_logs(&log_dir);

    let timestamp = Utc::now().format("%Y%m%dT%H%M%S");
    let path = log_dir.join(format!("{APP_LOG_PREFIX}{timestamp}{APP_LOG_SUFFIX}"));
    let writer = AppLogWriter::file(path);

    let _ = install_subscriber(writer);
}

fn install_subscriber(
    writer: AppLogWriter,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let json_layer = tracing_subscriber::fmt::layer()
        .json()
        .with_writer(writer)
        .with_ansi(false);

    let registry = tracing_subscriber::registry().with(filter).with(json_layer);

    registry
        .try_init()
        .map_err(|error| -> Box<dyn std::error::Error + Send + Sync> { Box::new(error) })
}

/// Remove the oldest app log files so at most [`APP_LOG_RETAIN_COUNT`] remain.
fn prune_old_app_logs(log_dir: &Path) {
    let mut entries: Vec<(PathBuf, String)> = Vec::new();
    if let Ok(read_dir) = fs::read_dir(log_dir) {
        for entry in read_dir.flatten() {
            let path = entry.path();
            let name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n.to_owned(),
                None => continue,
            };
            if name.starts_with(APP_LOG_PREFIX) && name.ends_with(APP_LOG_SUFFIX) {
                entries.push((path, name));
            }
        }
    }
    entries.sort_by(|a, b| b.1.cmp(&a.1));
    for (path, _) in entries
        .into_iter()
        .skip(APP_LOG_RETAIN_COUNT.saturating_sub(1))
    {
        let _ = fs::remove_file(path);
    }
}

/// A `MakeWriter` that appends every event to a single shared log file.
///
/// Opening the file per-event keeps the implementation small and avoids
/// holding a long-lived handle that would prevent rotation/pruning. App log
/// volume is low (diagnostics only), so the per-event open cost is negligible.
#[derive(Clone)]
pub struct AppLogWriter {
    path: Option<PathBuf>,
}

impl AppLogWriter {
    fn file(path: PathBuf) -> Self {
        Self { path: Some(path) }
    }

    fn stderr() -> Self {
        Self { path: None }
    }
}

/// Warn once when the log file cannot be opened, then fall back to stderr.
static LOG_FILE_OPEN_WARN_ONCE: Once = Once::new();

impl<'a> MakeWriter<'a> for AppLogWriter {
    type Writer = AppLogSink;

    fn make_writer(&'a self) -> Self::Writer {
        match &self.path {
            Some(path) => match OpenOptions::new().create(true).append(true).open(path) {
                Ok(file) => AppLogSink::File(Some(file)),
                Err(error) => {
                    let path = path.clone();
                    LOG_FILE_OPEN_WARN_ONCE.call_once(|| {
                        eprintln!(
                            "warning: failed to open log file {}: {error}; falling back to stderr",
                            path.display()
                        );
                    });
                    AppLogSink::Stderr
                }
            },
            None => AppLogSink::Stderr,
        }
    }
}

/// Output sink backing [`AppLogWriter`].
pub enum AppLogSink {
    File(Option<fs::File>),
    Stderr,
}

impl Write for AppLogSink {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        match self {
            AppLogSink::File(Some(file)) => {
                file.write_all(buf)?;
                Ok(buf.len())
            }
            AppLogSink::File(None) => std::io::stderr().write(buf),
            AppLogSink::Stderr => std::io::stderr().write(buf),
        }
    }

    fn flush(&mut self) -> std::io::Result<()> {
        match self {
            AppLogSink::File(Some(file)) => file.flush(),
            AppLogSink::File(None) => std::io::stderr().flush(),
            AppLogSink::Stderr => std::io::stderr().flush(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_log_writer_appends_to_file() {
        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("openloop-test.log");
        let writer = AppLogWriter::file(path.clone());
        let mut sink = writer.make_writer();
        sink.write_all(b"event\n").expect("write log line");

        let content = fs::read_to_string(path).expect("read log file");
        assert_eq!(content, "event\n");
    }

    #[test]
    fn app_log_writer_falls_back_to_stderr_when_open_fails() {
        let dir = tempfile::tempdir().expect("temp dir");
        let writer = AppLogWriter::file(dir.path().to_path_buf());
        let sink = writer.make_writer();
        assert!(matches!(sink, AppLogSink::Stderr));
    }

    #[test]
    fn app_log_writer_stderr_fallback_accepts_writes() {
        let dir = tempfile::tempdir().expect("temp dir");
        let writer = AppLogWriter::file(dir.path().to_path_buf());
        let mut sink = writer.make_writer();
        assert!(matches!(sink, AppLogSink::Stderr));
        sink.write_all(b"fallback\n").expect("stderr write");
        sink.flush().expect("stderr flush");
    }

    fn write_log_file(dir: &Path, name: &str, lines: &[&str]) {
        let log_dir = dir.join("logs").join("app");
        fs::create_dir_all(&log_dir).expect("create log dir");
        let path = log_dir.join(name);
        let mut content = String::new();
        for line in lines {
            content.push_str(line);
            content.push('\n');
        }
        fs::write(path, content).expect("write log file");
    }

    fn json_line(level: &str, target: &str, msg: &str) -> String {
        serde_json::json!({
            "timestamp": "2026-07-04T12:00:00Z",
            "level": level,
            "target": target,
            "fields": { "message": msg }
        })
        .to_string()
    }

    #[test]
    fn read_app_logs_parses_jsonl_entries() {
        let dir = tempfile::tempdir().expect("temp dir");
        write_log_file(
            dir.path(),
            "openloop-20260704T120000.log",
            &[
                &json_line("info", "app", "started"),
                &json_line("error", "backend", "failed"),
            ],
        );

        let entries = read_app_logs(dir.path(), None, None);
        assert_eq!(entries.len(), 2);
        // newest-first (file is appended oldest-first, reversed on read)
        assert_eq!(entries[0].level, "error");
        assert_eq!(entries[0].target, "backend");
        assert_eq!(entries[1].level, "info");
    }

    #[test]
    fn read_app_logs_filters_by_min_level() {
        let dir = tempfile::tempdir().expect("temp dir");
        write_log_file(
            dir.path(),
            "openloop-20260704T120000.log",
            &[
                &json_line("trace", "app", "t"),
                &json_line("debug", "app", "d"),
                &json_line("info", "app", "i"),
                &json_line("warn", "app", "w"),
                &json_line("error", "app", "e"),
            ],
        );

        let entries = read_app_logs(dir.path(), Some("warn"), None);
        assert_eq!(entries.len(), 2);
        assert!(entries.iter().all(|e| e.level == "warn" || e.level == "error"));
    }

    #[test]
    fn read_app_logs_respects_limit() {
        let dir = tempfile::tempdir().expect("temp dir");
        let lines: Vec<String> = (0..10).map(|i| json_line("info", "app", &format!("m{i}"))).collect();
        let refs: Vec<&str> = lines.iter().map(|s| s.as_str()).collect();
        write_log_file(dir.path(), "openloop-20260704T120000.log", &refs);

        let entries = read_app_logs(dir.path(), None, Some(3));
        assert_eq!(entries.len(), 3);
    }

    #[test]
    fn read_app_logs_limit_returns_newest_entries() {
        let dir = tempfile::tempdir().expect("temp dir");
        // File is appended oldest-first: m0, m1, ..., m9
        let lines: Vec<String> = (0..10).map(|i| json_line("info", "app", &format!("m{i}"))).collect();
        let refs: Vec<&str> = lines.iter().map(|s| s.as_str()).collect();
        write_log_file(dir.path(), "openloop-20260704T120000.log", &refs);

        let entries = read_app_logs(dir.path(), None, Some(3));
        // Newest-first after reverse+truncate: m9, m8, m7
        let messages: Vec<String> = entries
            .iter()
            .map(|e| e.fields["message"].as_str().unwrap().to_owned())
            .collect();
        assert_eq!(messages, vec!["m9", "m8", "m7"]);
    }

    #[test]
    fn read_app_logs_unknown_level_excluded_by_filter() {
        let dir = tempfile::tempdir().expect("temp dir");
        // Entry with no "level" field → defaults to "unknown"
        let no_level = serde_json::json!({
            "timestamp": "2026-07-04T12:00:00Z",
            "target": "app",
            "fields": { "message": "no-level" }
        })
        .to_string();
        let warn_line = json_line("warn", "app", "warn-entry");
        write_log_file(
            dir.path(),
            "openloop-20260704T120000.log",
            &[&no_level, &warn_line],
        );

        // Filtering for "warn" should exclude the unknown-level entry
        let entries = read_app_logs(dir.path(), Some("warn"), None);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].level, "warn");
    }

    #[test]
    fn read_app_logs_returns_empty_when_no_log_file() {
        let dir = tempfile::tempdir().expect("temp dir");
        let entries = read_app_logs(dir.path(), None, None);
        assert!(entries.is_empty());
    }

    #[test]
    fn read_app_logs_picks_latest_file() {
        let dir = tempfile::tempdir().expect("temp dir");
        write_log_file(
            dir.path(),
            "openloop-20260704T110000.log",
            &[&json_line("info", "old", "old")],
        );
        write_log_file(
            dir.path(),
            "openloop-20260704T120000.log",
            &[&json_line("info", "new", "new")],
        );

        let entries = read_app_logs(dir.path(), None, None);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].target, "new");
    }
}
