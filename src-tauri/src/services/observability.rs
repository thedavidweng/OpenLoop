use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use chrono::Utc;
use tracing_subscriber::{
    fmt::MakeWriter, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter,
};

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

impl<'a> MakeWriter<'a> for AppLogWriter {
    type Writer = AppLogSink;

    fn make_writer(&'a self) -> Self::Writer {
        match &self.path {
            Some(path) => {
                let file = OpenOptions::new().create(true).append(true).open(path).ok();
                AppLogSink::File(file)
            }
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
            AppLogSink::File(None) => Ok(buf.len()),
            AppLogSink::Stderr => std::io::stderr().write(buf),
        }
    }

    fn flush(&mut self) -> std::io::Result<()> {
        match self {
            AppLogSink::File(Some(file)) => file.flush(),
            AppLogSink::File(None) => Ok(()),
            AppLogSink::Stderr => std::io::stderr().flush(),
        }
    }
}
