use std::{fs, net::TcpStream, path::PathBuf};

use super::AppState;
use crate::{
    cli::{cli_error, human_output},
    models::{errors::AppResult, settings::ModelVariant},
    services::{backend_provisioner::read_backend_manifest, device, model_manager::read_manifest},
};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CheckResult {
    name: String,
    status: String,
    message: String,
}

pub fn execute(state: &AppState, json: bool) -> AppResult<()> {
    let settings = state.db.get_settings()?;
    let mut results: Vec<CheckResult> = Vec::new();

    // -----------------------------------------------------------------------
    // 1. System info
    // -----------------------------------------------------------------------
    match device::detect_device_info() {
        Ok(info) => {
            let chip = info
                .cpu_brand
                .as_deref()
                .unwrap_or(if info.is_apple_silicon {
                    "Apple Silicon"
                } else {
                    "Intel"
                });
            results.push(CheckResult {
                name: "system".to_owned(),
                status: "ok".to_owned(),
                message: format!(
                    "macOS {} / {} / {} / {}GB",
                    info.os, info.arch, chip, info.total_memory_gb
                ),
            });
        }
        Err(error) => {
            results.push(CheckResult {
                name: "system".to_owned(),
                status: "error".to_owned(),
                message: format!("failed to detect device info: {:?}", error),
            });
        }
    }

    // -----------------------------------------------------------------------
    // 2. Port occupancy
    // -----------------------------------------------------------------------
    let port = settings.backend_port;
    match TcpStream::connect(format!("127.0.0.1:{port}")) {
        Ok(_) => {
            results.push(CheckResult {
                name: "port".to_owned(),
                status: "ok".to_owned(),
                message: format!("port {port} is in use (backend may be running)"),
            });
        }
        Err(_) => {
            results.push(CheckResult {
                name: "port".to_owned(),
                status: "ok".to_owned(),
                message: format!("port {port} is available"),
            });
        }
    }

    // -----------------------------------------------------------------------
    // 3. App data directory
    // -----------------------------------------------------------------------
    let app_data_path = &state.app_data_dir;
    if app_data_path.exists() {
        results.push(CheckResult {
            name: "app-data-dir".to_owned(),
            status: "ok".to_owned(),
            message: format!("{} exists", app_data_path.display()),
        });
    } else {
        results.push(CheckResult {
            name: "app-data-dir".to_owned(),
            status: "warn".to_owned(),
            message: format!("{} does not exist", app_data_path.display()),
        });
    }

    // -----------------------------------------------------------------------
    // 4. Model directory
    // -----------------------------------------------------------------------
    let model_dir = settings
        .model_directory
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or_else(|| state.app_data_dir.join("models"));

    if model_dir.exists() {
        let entries: Vec<_> = match fs::read_dir(&model_dir) {
            Ok(iter) => iter
                .filter_map(|entry| {
                    entry
                        .ok()
                        .map(|e| e.file_name().to_string_lossy().to_string())
                })
                .collect(),
            Err(_) => vec![],
        };
        if entries.is_empty() {
            results.push(CheckResult {
                name: "model-dir".to_owned(),
                status: "ok".to_owned(),
                message: format!("{} exists (empty)", model_dir.display()),
            });
        } else {
            results.push(CheckResult {
                name: "model-dir".to_owned(),
                status: "ok".to_owned(),
                message: format!("{} exists ({} entries)", model_dir.display(), entries.len()),
            });
        }
    } else {
        results.push(CheckResult {
            name: "model-dir".to_owned(),
            status: "warn".to_owned(),
            message: format!("{} does not exist", model_dir.display()),
        });
    }

    // -----------------------------------------------------------------------
    // 5. Downloaded models (cross-check manifest ↔ DB)
    // -----------------------------------------------------------------------
    let mut downloaded = settings.downloaded_models.clone();

    // Sync from manifest if it has entries the DB is missing
    if let Ok(manifest) = read_manifest(&state.app_data_dir) {
        for key in manifest.installed.keys() {
            let variant = match key.as_str() {
                "lite" => Some(ModelVariant::Lite),
                "turbo" => Some(ModelVariant::Turbo),
                "pro" => Some(ModelVariant::Pro),
                _ => None,
            };
            if let Some(v) = variant {
                if !downloaded.contains(&v) {
                    downloaded.push(v);
                }
            }
        }
        if downloaded != settings.downloaded_models {
            let _ = state.db.set_setting(
                "downloadedModels",
                serde_json::to_value(&downloaded).unwrap_or_default(),
            );
        }
    }

    if downloaded.is_empty() {
        results.push(CheckResult {
            name: "downloaded-models".to_owned(),
            status: "warn".to_owned(),
            message: "no models downloaded".to_owned(),
        });
    } else {
        let labels: Vec<String> = downloaded
            .iter()
            .map(|v| match v {
                ModelVariant::Lite => "lite".to_owned(),
                ModelVariant::Turbo => "turbo".to_owned(),
                ModelVariant::Pro => "pro".to_owned(),
            })
            .collect();
        results.push(CheckResult {
            name: "downloaded-models".to_owned(),
            status: "ok".to_owned(),
            message: format!("downloaded: {}", labels.join(", ")),
        });
    }

    // -----------------------------------------------------------------------
    // 6. Backend logs
    // -----------------------------------------------------------------------
    let log_dir = settings
        .log_directory
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or_else(|| state.app_data_dir.join("logs/backend"));

    if log_dir.exists() {
        let mut log_files: Vec<_> = match fs::read_dir(&log_dir) {
            Ok(iter) => iter
                .filter_map(|entry| {
                    let path = entry.ok()?.path();
                    let name = path.file_name()?.to_string_lossy().to_string();
                    if name.starts_with("ace-step-") && name.ends_with(".log") {
                        Some(path)
                    } else {
                        None
                    }
                })
                .collect(),
            Err(_) => vec![],
        };
        log_files.sort();

        if let Some(latest) = log_files.last() {
            results.push(CheckResult {
                name: "backend-logs".to_owned(),
                status: "ok".to_owned(),
                message: format!("latest log: {}", latest.display()),
            });
        } else {
            results.push(CheckResult {
                name: "backend-logs".to_owned(),
                status: "ok".to_owned(),
                message: format!("{} exists (no backend logs yet)", log_dir.display()),
            });
        }
    } else {
        results.push(CheckResult {
            name: "backend-logs".to_owned(),
            status: "ok".to_owned(),
            message: format!("{} does not exist (no logs yet)", log_dir.display()),
        });
    }

    // -----------------------------------------------------------------------
    // 7. Backend code
    // -----------------------------------------------------------------------
    let runtime_dir = state.app_data_dir.join("runtime").join("ACE-Step-1.5");
    let pyproject = runtime_dir.join("pyproject.toml");
    let manifest = read_backend_manifest(&state.app_data_dir);

    if pyproject.exists() {
        let version_info = match &manifest {
            Some(m) => {
                let tag = m
                    .installed_tag
                    .as_deref()
                    .unwrap_or(&m.installed_commit[..7.min(m.installed_commit.len())]);
                format!(
                    "{tag} (installed {})",
                    m.installed_at.split('T').next().unwrap_or("")
                )
            }
            None => "present (no manifest)".to_owned(),
        };
        results.push(CheckResult {
            name: "backend-code".to_owned(),
            status: "ok".to_owned(),
            message: format!("{} — {}", runtime_dir.display(), version_info),
        });
    } else {
        results.push(CheckResult {
            name: "backend-code".to_owned(),
            status: "warn".to_owned(),
            message: format!(
                "ACE-Step backend code not installed at {}. Run 'openloop backend provision'.",
                runtime_dir.display()
            ),
        });
    }

    // -----------------------------------------------------------------------
    // 8. Database
    // -----------------------------------------------------------------------
    let db_path = state.app_data_dir.join("openloop.sqlite3");
    if db_path.exists() {
        match fs::metadata(&db_path) {
            Ok(meta) => {
                if meta.is_file() && meta.len() > 0 {
                    results.push(CheckResult {
                        name: "database".to_owned(),
                        status: "ok".to_owned(),
                        message: format!("{} ({} bytes)", db_path.display(), meta.len()),
                    });
                } else {
                    results.push(CheckResult {
                        name: "database".to_owned(),
                        status: "warn".to_owned(),
                        message: format!("{} is empty", db_path.display()),
                    });
                }
            }
            Err(error) => {
                results.push(CheckResult {
                    name: "database".to_owned(),
                    status: "error".to_owned(),
                    message: format!("failed to read {}: {error}", db_path.display()),
                });
            }
        }
    } else {
        results.push(CheckResult {
            name: "database".to_owned(),
            status: "error".to_owned(),
            message: format!("{} not found", db_path.display()),
        });
    }

    // -----------------------------------------------------------------------
    // 8. Settings summary
    // -----------------------------------------------------------------------
    let variant_label = settings
        .model_variant
        .map(|v| match v {
            crate::models::settings::ModelVariant::Lite => "lite",
            crate::models::settings::ModelVariant::Turbo => "turbo",
            crate::models::settings::ModelVariant::Pro => "pro",
        })
        .unwrap_or("none");
    results.push(CheckResult {
        name: "settings".to_owned(),
        status: "ok".to_owned(),
        message: format!(
            "model={variant_label} port={} thinking={} duration={}s format={}",
            settings.backend_port,
            if settings.default_thinking {
                "on"
            } else {
                "off"
            },
            settings.default_duration_seconds as i64,
            settings.default_audio_format,
        ),
    });

    // -----------------------------------------------------------------------
    // Output
    // -----------------------------------------------------------------------
    if json {
        super::json_output(
            &serde_json::to_string_pretty(&results).map_err(|e| cli_error(e.to_string()))?,
        );
    } else {
        for check in &results {
            let icon = match check.status.as_str() {
                "ok" => "\x1b[32m✓\x1b[0m",
                "warn" => "\x1b[33m⚠\x1b[0m",
                "error" => "\x1b[31m✗\x1b[0m",
                _ => "?",
            };
            human_output(&format!("{icon} {}: {}", check.name, check.message));
        }
    }

    Ok(())
}
