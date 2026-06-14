use super::AppState;
use crate::{
    cli::{cli_error, human_output},
    models::{backend::BackendStatus, errors::AppResult},
    services::device,
};

pub fn execute(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = args.contains(&"--json".to_owned());
    let help = args.contains(&"--help".to_owned()) || args.contains(&"-h".to_owned());

    if help {
        print_help();
        return Ok(());
    }

    let settings = state.db.get_settings()?;
    let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
    let status = backend.status_with_port(Some(settings.backend_port));
    let active_tasks = state.db.list_active_generation_tasks()?;
    let device_info = device::detect_device_info()?;

    if json {
        let backend_state = match &status {
            BackendStatus::Stopped => "stopped",
            BackendStatus::Starting => "starting",
            BackendStatus::Healthy { .. } => "healthy",
            BackendStatus::Failed { .. } => "failed",
        };

        let port = match &status {
            BackendStatus::Healthy { port } => Some(*port),
            _ => Some(settings.backend_port),
        };

        let tasks_json: Vec<serde_json::Value> = active_tasks
            .iter()
            .map(|task| {
                serde_json::json!({
                    "id": task.id,
                    "prompt": task.request.prompt,
                    "status": "running",
                })
            })
            .collect();

        let is_downloaded = settings
            .model_variant
            .map(|v| settings.downloaded_models.contains(&v))
            .unwrap_or(false);

        let output = serde_json::json!({
            "backend": {
                "state": backend_state,
                "port": port,
                "ownership": backend.ownership(),
            },
            "model": {
                "variant": settings.model_variant.map(|v| format!("{:?}", v).to_lowercase()),
                "downloaded": is_downloaded,
            },
            "activeTasks": tasks_json,
            "device": {
                "os": device_info.os,
                "arch": device_info.arch,
                "isAppleSilicon": device_info.is_apple_silicon,
                "totalMemoryGb": device_info.total_memory_gb,
            },
        });

        super::json_output(
            &serde_json::to_string_pretty(&output).map_err(|e| cli_error(e.to_string()))?,
        );
    } else {
        let ownership = backend.ownership();
        match &status {
            BackendStatus::Healthy { port } => {
                human_output(&format!("Backend: healthy (port {port}, {ownership})"));
            }
            BackendStatus::Starting => {
                human_output(&format!("Backend: starting ({ownership})"));
            }
            BackendStatus::Stopped => {
                human_output(&format!("Backend: stopped ({ownership})"));
            }
            BackendStatus::Failed { error } => {
                human_output(&format!(
                    "Backend: failed — {} ({ownership})",
                    error.message
                ));
            }
        }

        if let Some(variant) = settings.model_variant {
            let label = match variant {
                crate::models::settings::ModelVariant::Lite => "Lite",
                crate::models::settings::ModelVariant::Turbo => "Turbo",
                crate::models::settings::ModelVariant::Pro => "Pro",
            };
            let downloaded = if settings.downloaded_models.contains(&variant) {
                "downloaded"
            } else {
                "not downloaded"
            };
            human_output(&format!("Model:   {label} ({downloaded})"));
        } else {
            human_output("Model:   none");
        }

        human_output(&format!("Active tasks: {}", active_tasks.len()));
        for task in &active_tasks {
            let short_id = &task.id[..8.min(task.id.len())];
            human_output(&format!(
                "  {short_id}  \"{}\"  running",
                task.request.prompt
            ));
        }

        let cpu_label =
            device_info
                .cpu_brand
                .as_deref()
                .unwrap_or(if device_info.is_apple_silicon {
                    "Apple Silicon"
                } else {
                    "Intel"
                });
        human_output(&format!(
            "Device: macOS ({cpu_label}, {}GB)",
            device_info.total_memory_gb
        ));
    }

    Ok(())
}

fn print_help() {
    human_output(
        "\
openloop status — Show unified system status

Usage:
  openloop status [flags]

Flags:
  --json    JSON object output
  --help    Show help",
    );
}
