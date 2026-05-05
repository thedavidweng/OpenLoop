use crate::{
    cli::{cli_error, human_output},
    models::{backend::BackendStatus, errors::AppResult},
};

use super::AppState;

pub fn execute(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = args.contains(&"--json".to_owned());
    let help = args.contains(&"--help".to_owned()) || args.contains(&"-h".to_owned());

    if help {
        print_help();
        return Ok(());
    }

    let settings = state.db.get_settings()?;
    let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
    let status = backend.status();

    let active_tasks = state.db.list_active_generation_tasks()?;

    if json {
        let backend_state = match &status {
            BackendStatus::Stopped => "stopped",
            BackendStatus::Starting => "starting",
            BackendStatus::Healthy { .. } => "healthy",
            BackendStatus::Failed { .. } => "failed",
        };

        let tasks_json: Vec<serde_json::Value> = active_tasks
            .iter()
            .map(|task| {
                serde_json::json!({
                    "id": task.id,
                    "prompt": task.request.prompt,
                    "status": "running",
                    "elapsed_seconds": 0,
                })
            })
            .collect();

        let output = serde_json::json!({
            "backend": backend_state,
            "port": settings.backend_port,
            "model": settings.model_variant.map(|v| format!("{:?}", v).to_lowercase()),
            "active_tasks": tasks_json,
        });

        super::json_output(
            &serde_json::to_string_pretty(&output).map_err(|e| cli_error(e.to_string()))?,
        );
    } else {
        match &status {
            BackendStatus::Healthy { port } => {
                human_output(&format!("Backend: healthy (port {port})"));
            }
            BackendStatus::Starting => {
                human_output("Backend: starting…");
            }
            BackendStatus::Stopped => {
                human_output("Backend: stopped");
            }
            BackendStatus::Failed { error } => {
                human_output(&format!("Backend: failed — {}", error.message));
            }
        }

        if let Some(variant) = settings.model_variant {
            let label = match variant {
                crate::models::settings::ModelVariant::Lite => "lite",
                crate::models::settings::ModelVariant::Turbo => "turbo",
                crate::models::settings::ModelVariant::Pro => "pro",
            };
            human_output(&format!("Model:   {label}"));
        }

        human_output(&format!("Active tasks: {}", active_tasks.len()));
        for task in &active_tasks {
            let short_id = &task.id[..8.min(task.id.len())];
            human_output(&format!(
                "  {short_id}  \"{}\"  running",
                task.request.prompt
            ));
        }
    }

    Ok(())
}

fn print_help() {
    human_output(
        "\
openloop ps — Show backend status and active generation tasks

Usage:
  openloop ps [flags]

Flags:
  --json    JSON object output
  --help    Show help",
    );
}
