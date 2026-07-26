use serde::Serialize;
use tauri::State;

use crate::{
    models::{backend::BackendStatus, errors::AppResult},
    AppState,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsBundle {
    pub app_version: String,
    pub os: String,
    pub arch: String,
    pub is_apple_silicon: bool,
    pub total_memory_gb: u64,
    pub tauri_version: String,
    /// Git short SHA embedded at build time, or "unknown" for non-git builds.
    pub build_sha: String,
    /// Absolute path to the app's structured log directory.
    pub app_log_dir: String,
    pub backend_status: BackendStatus,
    /// Recent error events — currently not tracked; reserved for future use.
    pub recent_errors: Option<Vec<String>>,
}

#[tauri::command]
pub fn collect_diagnostics(state: State<'_, AppState>) -> AppResult<DiagnosticsBundle> {
    let arch = std::env::consts::ARCH.to_string();
    let is_apple_silicon = cfg!(target_os = "macos") && arch == "aarch64";

    let total_memory_gb = detect_memory_gb();

    let backend_status = state
        .backend
        .lock()
        .map_err(|_| crate::models::errors::AppError::internal("backend manager lock poisoned"))?
        .status();

    let app_log_dir = crate::services::observability::app_log_dir(&state.app_data_dir)
        .display()
        .to_string();

    Ok(DiagnosticsBundle {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch,
        is_apple_silicon,
        total_memory_gb,
        tauri_version: tauri::VERSION.to_string(),
        build_sha: option_env!("GIT_BUILD_HASH")
            .unwrap_or("unknown")
            .to_string(),
        app_log_dir,
        backend_status,
        recent_errors: None,
    })
}

fn detect_memory_gb() -> u64 {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("sysctl")
            .args(["-n", "hw.memsize"])
            .output()
            .ok()
            .and_then(|output| {
                if output.status.success() {
                    String::from_utf8(output.stdout).ok()
                } else {
                    None
                }
            })
            .and_then(|value| value.trim().parse::<u64>().ok())
            .map(|bytes| ((bytes as f64) / 1_073_741_824.0).round() as u64)
            .unwrap_or(0)
    }

    #[cfg(not(target_os = "macos"))]
    {
        0
    }
}
