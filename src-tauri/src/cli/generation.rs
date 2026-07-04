use std::sync::atomic::Ordering;

use crate::{
    cli::{cli_error, events, human_output},
    models::{backend::BackendStatus, errors::AppResult},
    services::{
        ace_client::AceClient,
        file_store::FileStore,
        generation_task::{GenerationEventSink, GenerationTaskRunner},
    },
};

use super::AppState;
use crate::cli::spec::GenerationCommand;

pub fn execute(state: &AppState, json: bool, command: GenerationCommand) -> AppResult<()> {
    match command {
        GenerationCommand::List => cmd_list(state, json),
        GenerationCommand::Cancel { id, kill_backend } => cmd_cancel(state, json, id, kill_backend),
        GenerationCommand::Resume { id } => cmd_resume(state, json, &id),
        GenerationCommand::Discard { id, yes } => cmd_discard(state, &id, yes),
    }
}

fn cmd_list(state: &AppState, json: bool) -> AppResult<()> {
    let tasks = state.db.list_active_generation_tasks()?;

    if json {
        let output = serde_json::to_string_pretty(&tasks).map_err(|e| cli_error(e.to_string()))?;
        super::json_output(&output);
    } else {
        if tasks.is_empty() {
            human_output("No active generation tasks.");
            return Ok(());
        }
        println!("{:<12} {:<24} {:<10}", "ID", "Prompt", "Status");
        println!("{}", "-".repeat(50));
        for task in &tasks {
            let short_id = &task.id[..8.min(task.id.len())];
            let prompt = if task.request.prompt.len() > 22 {
                format!("{}…", &task.request.prompt[..21])
            } else {
                task.request.prompt.clone()
            };
            println!("{:<12} {:<24} {:<10}", short_id, prompt, "running");
        }
    }
    Ok(())
}

fn cmd_cancel(
    state: &AppState,
    json: bool,
    id: Option<String>,
    kill_backend: bool,
) -> AppResult<()> {
    if let Some(task_id) = id {
        // Targeted DB-level cancellation for cross-process visibility
        let runner = GenerationTaskRunner::new(
            state.db.clone(),
            FileStore::new(state.app_data_dir.clone()),
            state.generation_cancelled.clone(),
        );
        runner.request_cancel_via_db(Some(&task_id))?;
        if json {
            super::json_output(&format!(
                r#"{{"event":"cancel_requested","task_id":"{task_id}""#
            ));
        } else {
            human_output(&format!("Cancel requested for generation {task_id}"));
        }
    } else {
        // Global cancellation via process-level flag and DB-level for all active tasks
        state.generation_cancelled.store(true, Ordering::SeqCst);
        let runner = GenerationTaskRunner::new(
            state.db.clone(),
            FileStore::new(state.app_data_dir.clone()),
            state.generation_cancelled.clone(),
        );
        let _ = runner.request_cancel_via_db(None);
        if json {
            super::json_output(r#"{"event":"cancelled"}"#);
        } else {
            human_output("Generation cancelled.");
        }
    }

    // --kill-backend: stop the backend if we own it
    if kill_backend {
        let mut backend = state
            .backend
            .lock()
            .map_err(|e| crate::models::errors::AppError::internal(format!("backend lock: {e}")))?;
        if backend.is_owned() {
            backend.stop()?;
            if !json {
                human_output("✓ Owned backend stopped.");
            }
        } else if !json {
            human_output("⚠ Backend is not owned by this process; not stopping.");
        }
    }

    Ok(())
}

fn cmd_resume(state: &AppState, json: bool, id: &str) -> AppResult<()> {
    let settings = state.db.get_settings()?;

    // Ensure backend is healthy
    {
        let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
        if !matches!(backend.status(), BackendStatus::Healthy { .. }) {
            return Err(cli_error(
                "active task can only be resumed while the ACE-Step backend is still healthy",
            ));
        }
    }

    let client = AceClient::new(settings.backend_port)?;
    client.health()?;

    let active = state
        .db
        .get_active_generation_task(id)?
        .ok_or_else(|| cli_error(format!("active generation task not found: {id}")))?;

    let runner = GenerationTaskRunner::new(
        state.db.clone(),
        FileStore::new(state.app_data_dir.clone()),
        state.generation_cancelled.clone(),
    );

    let sink = GenerationCliSink;
    let record = runner.resume(&client, &sink, &settings, active)?;

    if json {
        super::json_output(&serde_json::to_string(&record).map_err(|e| cli_error(e.to_string()))?);
    } else {
        human_output(&format!(
            "✓ Generated: {} ({}s)",
            record.output_path.as_deref().unwrap_or("unknown"),
            record.duration_seconds as i64,
        ));
    }

    Ok(())
}

fn cmd_discard(state: &AppState, id: &str, yes: bool) -> AppResult<()> {
    if !yes {
        use std::io::Write;
        print!("Discard active generation task {id}? [y/N] ");
        std::io::stdout().flush().ok();
        let mut input = String::new();
        std::io::stdin()
            .read_line(&mut input)
            .map_err(|e| cli_error(e.to_string()))?;
        if !["y\n", "Y\n", "yes\n", "Yes\n"].contains(&input.as_str()) {
            human_output("Cancelled.");
            return Ok(());
        }
    }

    state.db.delete_active_generation_task(id)?;
    human_output(&format!("✓ Discarded generation task {id}"));
    Ok(())
}

struct GenerationCliSink;

impl GenerationEventSink for GenerationCliSink {
    fn emit_generation_event(&self, payload: serde_json::Value) -> AppResult<()> {
        let event_type = payload
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        match event_type {
            "completed" => {
                let path = payload
                    .get("outputPath")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                events::human_success(&format!("Generated: {path}"));
            }
            "failed" => {
                let error = payload
                    .get("error")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown error");
                events::human_error(error);
            }
            "cancelled" => {
                events::human_info("Cancelled.");
            }
            _ => {
                let variation = payload
                    .get("variationCurrent")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                let total = payload
                    .get("variationTotal")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                if total > 0 {
                    eprint!("\r  Generating variation {variation}/{total}…");
                }
            }
        }
        Ok(())
    }
}
