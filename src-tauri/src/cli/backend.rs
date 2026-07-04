use std::process::Command;

use crate::{
    cli::{cli_error, events, human_output},
    models::{
        backend::BackendStatus,
        errors::{AppError, AppResult},
    },
    services::{
        backend_provisioner::{read_backend_manifest, BackendProvisioner},
        model_bootstrap::runtime_dir_for,
    },
};

use super::AppState;
use crate::cli::spec::BackendCommand;

pub fn execute(state: &AppState, json: bool, command: BackendCommand) -> AppResult<()> {
    match command {
        BackendCommand::Status => execute_status(state, json),
        BackendCommand::Start => execute_start(state, json),
        BackendCommand::Stop => execute_stop(state, json),
        BackendCommand::Restart => execute_restart(state, json),
        BackendCommand::Logs { open } => execute_logs(state, json, open),
        BackendCommand::ClearCache => execute_clear_cache(state),
        BackendCommand::Provision => execute_provision(state, json),
        BackendCommand::Update => execute_update(state, json),
    }
}

fn backend_error_text(error: &AppError) -> String {
    error
        .details
        .as_deref()
        .unwrap_or(&error.message)
        .to_owned()
}

fn lifecycle_event(status: &BackendStatus, ownership: &str, message: String) -> serde_json::Value {
    let (phase, port, error_msg) = match status {
        BackendStatus::Healthy { port } => ("healthy", Some(*port), None),
        BackendStatus::Starting => ("starting", None, None),
        BackendStatus::Stopped => ("stopped", None, None),
        BackendStatus::Failed { error } => ("failed", None, Some(backend_error_text(error))),
    };

    let mut output = serde_json::json!({
        "v": 1,
        "ts": chrono::Utc::now().to_rfc3339(),
        "kind": "lifecycle",
        "phase": phase,
        "port": port,
        "ownership": ownership,
        "message": message,
    });

    if let (Some(obj), Some(error_msg)) = (output.as_object_mut(), error_msg) {
        obj.insert("error".to_owned(), serde_json::json!(error_msg));
    }

    output
}

fn print_json_value(output: &serde_json::Value) -> AppResult<()> {
    super::json_output(&serde_json::to_string(output).map_err(|e| cli_error(e.to_string()))?);
    Ok(())
}

fn status_lifecycle_message(status: &BackendStatus) -> String {
    match status {
        BackendStatus::Healthy { .. } => "Backend status: healthy".to_owned(),
        BackendStatus::Starting => "Backend status: starting".to_owned(),
        BackendStatus::Stopped => "Backend status: stopped".to_owned(),
        BackendStatus::Failed { error } => format!("Backend failed: {}", backend_error_text(error)),
    }
}

fn start_lifecycle_message(status: &BackendStatus) -> String {
    match status {
        BackendStatus::Healthy { port } => format!("Backend started (port {port})"),
        BackendStatus::Starting => "Backend starting…".to_owned(),
        BackendStatus::Stopped => "Backend: stopped".to_owned(),
        BackendStatus::Failed { error } => {
            format!("Backend failed to start: {}", backend_error_text(error))
        }
    }
}

fn restart_lifecycle_message(status: &BackendStatus) -> String {
    match status {
        BackendStatus::Healthy { port } => format!("Backend restarted (port {port})"),
        BackendStatus::Starting => "Backend restarting…".to_owned(),
        BackendStatus::Stopped => "Backend restarted".to_owned(),
        BackendStatus::Failed { error } => {
            format!("Backend failed to restart: {}", backend_error_text(error))
        }
    }
}

fn stop_lifecycle_message(status: &BackendStatus) -> String {
    match status {
        BackendStatus::Healthy { port } => format!("Backend still healthy (port {port})"),
        BackendStatus::Starting => "Backend stop pending".to_owned(),
        BackendStatus::Stopped => "Backend stopped".to_owned(),
        BackendStatus::Failed { error } => {
            format!("Backend failed to stop: {}", backend_error_text(error))
        }
    }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

fn execute_status(state: &AppState, json: bool) -> AppResult<()> {
    let settings = state.db.get_settings()?;
    let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
    let status = backend.status_with_port(Some(settings.backend_port));

    let ownership = backend.ownership();

    // Backend code provision status
    let provision_info = read_backend_manifest(&state.app_data_dir);

    if json {
        let mut output = lifecycle_event(&status, ownership, status_lifecycle_message(&status));
        if let Some(obj) = output.as_object_mut() {
            match &provision_info {
                Some(manifest) => {
                    obj.insert(
                        "backendCode".to_owned(),
                        serde_json::json!({
                            "installed": true,
                            "commit": manifest.installed_commit,
                            "tag": manifest.installed_tag,
                            "installedAt": manifest.installed_at,
                        }),
                    );
                }
                None => {
                    obj.insert(
                        "backendCode".to_owned(),
                        serde_json::json!({ "installed": false }),
                    );
                }
            }
        }
        print_json_value(&output)?;
    } else {
        match &status {
            BackendStatus::Healthy { port } => {
                events::human_success(&format!("Backend is healthy (port {port}) [{ownership}]"));
            }
            BackendStatus::Starting => {
                events::human_lifecycle("backend", &format!("starting… [{ownership}]"));
            }
            BackendStatus::Stopped => {
                human_output(&format!("Backend: stopped [{ownership}]"));
            }
            BackendStatus::Failed { error } => {
                events::human_error(&format!("Backend failed: {} [{ownership}]", error.message));
            }
        }

        match &provision_info {
            Some(manifest) => {
                let version = manifest.installed_tag.as_deref().unwrap_or(
                    &manifest.installed_commit[..7.min(manifest.installed_commit.len())],
                );
                human_output(&format!("Backend code: {version} (installed)"));
            }
            None => {
                human_output("Backend code: not installed (run 'openloop backend provision')");
            }
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

fn execute_start(state: &AppState, json: bool) -> AppResult<()> {
    let settings = state.db.get_settings()?;
    let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
    let status = match backend.start(&settings) {
        Ok(status) => status,
        Err(error) => {
            if json {
                let failed_status = BackendStatus::Failed {
                    error: error.clone(),
                };
                let output = lifecycle_event(
                    &failed_status,
                    backend.ownership(),
                    start_lifecycle_message(&failed_status),
                );
                print_json_value(&output)?;
            }
            return Err(error);
        }
    };
    let ownership = backend.ownership().to_owned();

    if json {
        let output = lifecycle_event(&status, &ownership, start_lifecycle_message(&status));
        print_json_value(&output)?;
    } else {
        match &status {
            BackendStatus::Healthy { port } => {
                events::human_success(&format!("Backend started (port {port})"));
            }
            BackendStatus::Starting => {
                events::human_lifecycle("backend", "starting…");
            }
            BackendStatus::Stopped => {
                human_output("Backend: stopped");
            }
            BackendStatus::Failed { error } => {
                events::human_error(&format!("Backend failed to start: {}", error.message));
            }
        }
    }

    // Detach so the backend keeps running after this CLI command exits
    backend.detach();

    Ok(())
}

// ---------------------------------------------------------------------------
// Stop
// ---------------------------------------------------------------------------

fn execute_stop(state: &AppState, json: bool) -> AppResult<()> {
    let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
    let status = match backend.stop() {
        Ok(status) => status,
        Err(error) => {
            if json {
                let failed_status = BackendStatus::Failed {
                    error: error.clone(),
                };
                let output = lifecycle_event(
                    &failed_status,
                    backend.ownership(),
                    stop_lifecycle_message(&failed_status),
                );
                print_json_value(&output)?;
            }
            return Err(error);
        }
    };
    let ownership = backend.ownership().to_owned();

    if json {
        let output = lifecycle_event(&status, &ownership, stop_lifecycle_message(&status));
        print_json_value(&output)?;
    } else {
        events::human_success("Backend stopped");
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Restart
// ---------------------------------------------------------------------------

fn execute_restart(state: &AppState, json: bool) -> AppResult<()> {
    let settings = state.db.get_settings()?;
    let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
    let status = match backend.restart(&settings) {
        Ok(status) => status,
        Err(error) => {
            if json {
                let failed_status = BackendStatus::Failed {
                    error: error.clone(),
                };
                let output = lifecycle_event(
                    &failed_status,
                    backend.ownership(),
                    restart_lifecycle_message(&failed_status),
                );
                print_json_value(&output)?;
            }
            return Err(error);
        }
    };
    let ownership = backend.ownership().to_owned();

    if json {
        let output = lifecycle_event(&status, &ownership, restart_lifecycle_message(&status));
        print_json_value(&output)?;
    } else {
        match &status {
            BackendStatus::Healthy { port } => {
                events::human_success(&format!("Backend restarted (port {port})"));
            }
            BackendStatus::Starting => {
                events::human_lifecycle("backend", "restarting…");
            }
            BackendStatus::Failed { error } => {
                events::human_error(&format!("Backend failed to restart: {}", error.message));
            }
            _ => {
                human_output("Backend restarted");
            }
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

fn execute_logs(state: &AppState, json: bool, open: bool) -> AppResult<()> {
    let backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
    let path = backend.logs_path();

    if json {
        let output = serde_json::json!({ "logs_path": path });
        super::json_output(&serde_json::to_string(&output).map_err(|e| cli_error(e.to_string()))?);
    } else {
        match &path {
            Some(p) => {
                human_output(p);
                if open {
                    #[cfg(target_os = "macos")]
                    {
                        Command::new("open")
                            .arg("-R")
                            .arg(p)
                            .spawn()
                            .map_err(|e| cli_error(format!("failed to open logs path: {e}")))?;
                    }
                    #[cfg(not(target_os = "macos"))]
                    {
                        human_output("The --open flag is currently only supported on macOS.");
                    }
                }
            }
            None => {
                human_output("No backend logs path available (backend has not been started yet).");
            }
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Clear-cache
// ---------------------------------------------------------------------------

fn execute_clear_cache(state: &AppState) -> AppResult<()> {
    let settings = state.db.get_settings()?;

    // Stop backend before clearing cache
    {
        let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
        backend.stop()?;
    }

    let cache_dir = runtime_dir_for(&state.app_data_dir, &settings).join(".cache");
    if cache_dir.exists() {
        std::fs::remove_dir_all(&cache_dir)
            .map_err(|e| cli_error(format!("failed to remove cache directory: {e}")))?;
        events::human_success("Backend cache cleared");
    } else {
        human_output("No cache directory found to clear");
    }

    Ok(())
}

/// Format a manifest version for display: prefer tag, fall back to short commit.
fn format_manifest_version(
    manifest: &Option<crate::services::backend_provisioner::BackendManifest>,
) -> String {
    match manifest {
        Some(m) => {
            if let Some(tag) = &m.installed_tag {
                tag.clone()
            } else {
                m.installed_commit[..7.min(m.installed_commit.len())].to_owned()
            }
        }
        None => "unknown".to_owned(),
    }
}

// ---------------------------------------------------------------------------
// Provision
// ---------------------------------------------------------------------------

fn execute_provision(state: &AppState, json: bool) -> AppResult<()> {
    let provisioner = BackendProvisioner::new(
        state.app_data_dir.clone(),
        std::sync::Arc::clone(&state.network_log),
    );
    if provisioner.is_provisioned() {
        let manifest = read_backend_manifest(&state.app_data_dir);
        let version = format_manifest_version(&manifest);
        if json {
            super::json_output(&format!(
                r#"{{"event":"already_installed","version":"{version}"}}"#
            ));
        } else {
            human_output(&format!("Backend code already installed ({version})."));
        }
        return Ok(());
    }

    if !json {
        human_output("Downloading ACE-Step backend code…");
    }

    provisioner.provision_blocking()?;

    let manifest = read_backend_manifest(&state.app_data_dir);
    let version = format_manifest_version(&manifest);

    if json {
        super::json_output(&format!(r#"{{"event":"installed","version":"{version}"}}"#));
    } else {
        events::human_success(&format!("Backend code installed ({version})."));
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

fn execute_update(state: &AppState, json: bool) -> AppResult<()> {
    let provisioner = BackendProvisioner::new(
        state.app_data_dir.clone(),
        std::sync::Arc::clone(&state.network_log),
    );

    if !provisioner.is_provisioned() {
        return Err(cli_error(
            "backend code is not installed. Run 'openloop backend provision' first.",
        ));
    }

    if !json {
        human_output("Checking for backend updates…");
    }

    let status = provisioner.check_for_updates()?;

    if !status.update_available {
        let version = status
            .installed_tag
            .as_deref()
            .or(status.installed_commit.as_deref())
            .unwrap_or("unknown");
        if json {
            super::json_output(&format!(
                r#"{{"event":"up_to_date","version":"{version}"}}"#
            ));
        } else {
            human_output(&format!("Backend code is up to date ({version})."));
        }
        return Ok(());
    }

    let latest = status.latest_tag.as_deref().unwrap_or("latest");
    if !json {
        human_output(&format!("Updating backend to {latest}…"));
    }

    provisioner.update_blocking()?;

    if json {
        super::json_output(&format!(r#"{{"event":"updated","version":"{latest}"}}"#));
    } else {
        events::human_success(&format!("Backend updated to {latest}."));
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Help printers
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::errors::AppError;

    #[test]
    fn failed_lifecycle_event_includes_structured_error() {
        let status = BackendStatus::Failed {
            error: AppError::backend_start_failed("port is already in use"),
        };

        let event = lifecycle_event(&status, "stopped", start_lifecycle_message(&status));

        assert_eq!(event["kind"], "lifecycle");
        assert_eq!(event["phase"], "failed");
        assert_eq!(event["port"], serde_json::Value::Null);
        assert_eq!(event["ownership"], "stopped");
        assert_eq!(event["error"], "port is already in use");
        assert_eq!(
            event["message"],
            "Backend failed to start: port is already in use"
        );
    }

    #[test]
    fn failed_stop_lifecycle_event_includes_structured_error() {
        let status = BackendStatus::Failed {
            error: AppError::backend_start_failed("failed to terminate backend process"),
        };

        let event = lifecycle_event(&status, "owned", stop_lifecycle_message(&status));

        assert_eq!(event["kind"], "lifecycle");
        assert_eq!(event["phase"], "failed");
        assert_eq!(event["ownership"], "owned");
        assert_eq!(event["error"], "failed to terminate backend process");
        assert_eq!(
            event["message"],
            "Backend failed to stop: failed to terminate backend process"
        );
    }
}
