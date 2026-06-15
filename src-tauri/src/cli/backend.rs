use std::process::Command;

use crate::{
    cli::{cli_error, events, human_output},
    models::{backend::BackendStatus, errors::AppResult},
    services::{
        backend_provisioner::{read_backend_manifest, BackendProvisioner},
        model_bootstrap::runtime_dir_for,
    },
};

use super::AppState;

pub fn execute(state: &AppState, args: &[String]) -> AppResult<()> {
    let help = args.contains(&"--help".to_owned()) || args.contains(&"-h".to_owned());
    let sub = subcommand(args);

    if help {
        match sub {
            Some("status") => print_status_help(),
            Some("start") => print_start_help(),
            Some("stop") => print_stop_help(),
            Some("restart") => print_restart_help(),
            Some("logs") => print_logs_help(),
            Some("clear-cache") => print_clear_cache_help(),
            Some("provision") => print_provision_help(),
            Some("update") => print_update_help(),
            _ => print_help(),
        }
        return Ok(());
    }

    match sub {
        Some("status") => execute_status(state, args),
        Some("start") => execute_start(state, args),
        Some("stop") => execute_stop(state, args),
        Some("restart") => execute_restart(state, args),
        Some("logs") => execute_logs(state, args),
        Some("clear-cache") => execute_clear_cache(state),
        Some("provision") => execute_provision(state, args),
        Some("update") => execute_update(state, args),
        None => {
            print_help();
            Ok(())
        }
        Some(unknown) => Err(cli_error(format!(
            "unknown backend subcommand '{unknown}'. Use 'openloop backend --help' to see available subcommands."
        ))),
    }
}

/// Extract the subcommand from args, skipping the leading "backend" at index 0
/// and any flag-like arguments.
fn subcommand(args: &[String]) -> Option<&str> {
    args.iter()
        .skip(1)
        .find(|a| !a.starts_with('-'))
        .map(|s| s.as_str())
}

fn json_flag(args: &[String]) -> bool {
    args.contains(&"--json".to_owned())
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

fn execute_status(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = json_flag(args);
    let settings = state.db.get_settings()?;
    let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
    let status = backend.status_with_port(Some(settings.backend_port));

    let ownership = backend.ownership();

    // Backend code provision status
    let provision_info = read_backend_manifest(&state.app_data_dir);

    if json {
        let (phase, port, error_msg) = match &status {
            BackendStatus::Healthy { port } => ("healthy", Some(*port), None),
            BackendStatus::Starting => ("starting", None, None),
            BackendStatus::Stopped => ("stopped", None, None),
            BackendStatus::Failed { error } => ("failed", None, Some(error.message.clone())),
        };
        let mut output = serde_json::json!({
            "v": 1,
            "ts": chrono::Utc::now().to_rfc3339(),
            "kind": "lifecycle",
            "phase": phase,
            "port": port,
            "ownership": ownership,
            "message": match &error_msg {
                Some(e) => format!("Backend failed: {e}"),
                None => format!("Backend status: {phase}"),
            },
        });
        if let Some(obj) = output.as_object_mut() {
            if let Some(e) = error_msg {
                obj.insert("error".to_owned(), serde_json::json!(e));
            }
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
        super::json_output(&serde_json::to_string(&output).map_err(|e| cli_error(e.to_string()))?);
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

fn execute_start(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = json_flag(args);
    let settings = state.db.get_settings()?;
    let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
    let status = backend.start(&settings)?;
    let ownership = backend.ownership().to_owned();

    if json {
        let (phase, port, msg) = match &status {
            BackendStatus::Healthy { port } => (
                "healthy",
                Some(*port),
                format!("Backend started (port {port})"),
            ),
            BackendStatus::Starting => ("starting", None, "Backend starting…".to_owned()),
            BackendStatus::Stopped => ("stopped", None, "Backend: stopped".to_owned()),
            BackendStatus::Failed { error } => {
                ("failed", None, format!("Backend failed: {}", error.message))
            }
        };
        let output = serde_json::json!({
            "v": 1,
            "ts": chrono::Utc::now().to_rfc3339(),
            "kind": "lifecycle",
            "phase": phase,
            "port": port,
            "ownership": ownership,
            "message": msg,
        });
        super::json_output(&serde_json::to_string(&output).map_err(|e| cli_error(e.to_string()))?);
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

fn execute_stop(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = json_flag(args);
    let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
    let ownership = backend.ownership().to_owned();
    let _status = backend.stop()?;

    if json {
        let output = serde_json::json!({
            "v": 1,
            "ts": chrono::Utc::now().to_rfc3339(),
            "kind": "lifecycle",
            "phase": "stopped",
            "port": null,
            "ownership": ownership,
            "message": "Backend stopped",
        });
        super::json_output(&serde_json::to_string(&output).map_err(|e| cli_error(e.to_string()))?);
    } else {
        events::human_success("Backend stopped");
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Restart
// ---------------------------------------------------------------------------

fn execute_restart(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = json_flag(args);
    let settings = state.db.get_settings()?;
    let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
    let status = backend.restart(&settings)?;
    let ownership = backend.ownership().to_owned();

    if json {
        let (phase, port, msg) = match &status {
            BackendStatus::Healthy { port } => (
                "healthy",
                Some(*port),
                format!("Backend restarted (port {port})"),
            ),
            BackendStatus::Starting => ("starting", None, "Backend restarting…".to_owned()),
            BackendStatus::Failed { error } => (
                "failed",
                None,
                format!("Backend failed to restart: {}", error.message),
            ),
            _ => ("stopped", None, "Backend restarted".to_owned()),
        };
        let output = serde_json::json!({
            "v": 1,
            "ts": chrono::Utc::now().to_rfc3339(),
            "kind": "lifecycle",
            "phase": phase,
            "port": port,
            "ownership": ownership,
            "message": msg,
        });
        super::json_output(&serde_json::to_string(&output).map_err(|e| cli_error(e.to_string()))?);
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

fn execute_logs(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = json_flag(args);
    let open = args.contains(&"--open".to_owned());
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

fn execute_provision(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = json_flag(args);

    let provisioner = BackendProvisioner::new(state.app_data_dir.clone());
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

fn execute_update(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = json_flag(args);

    let provisioner = BackendProvisioner::new(state.app_data_dir.clone());

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

fn print_help() {
    human_output(
        "\
openloop backend — Manage the local ACE-Step backend

Usage:
  openloop backend <subcommand> [flags]

Subcommands:
  status       Show backend health, port, and code version
  start        Start the backend
  stop         Stop the backend
  restart      Restart the backend
  logs         Print the backend logs path
  clear-cache  Stop backend and remove runtime cache
  provision    Download and install the ACE-Step backend code
  update       Update the backend code to the latest version

Flags:
  --json       JSON output (supported by most subcommands)
  --help       Show help

Examples:
  openloop backend status
  openloop backend status --json
  openloop backend start
  openloop backend stop
  openloop backend restart
  openloop backend logs
  openloop backend logs --open
  openloop backend clear-cache
  openloop backend provision
  openloop backend update",
    );
}

fn print_status_help() {
    human_output(
        "\
openloop backend status — Show backend health and port

Usage:
  openloop backend status [flags]

Flags:
  --json    JSON output
  --help    Show help",
    );
}

fn print_start_help() {
    human_output(
        "\
openloop backend start — Start the backend

Usage:
  openloop backend start [flags]

Flags:
  --json    JSON output
  --help    Show help",
    );
}

fn print_stop_help() {
    human_output(
        "\
openloop backend stop — Stop the backend

Usage:
  openloop backend stop [flags]

Flags:
  --json    JSON output
  --help    Show help",
    );
}

fn print_restart_help() {
    human_output(
        "\
openloop backend restart — Restart the backend

Usage:
  openloop backend restart [flags]

Flags:
  --json    JSON output
  --help    Show help",
    );
}

fn print_logs_help() {
    human_output(
        "\
openloop backend logs — Print the backend logs path

Usage:
  openloop backend logs [flags]

Flags:
  --json    JSON output
  --open    Reveal in Finder (macOS only)
  --help    Show help",
    );
}

fn print_clear_cache_help() {
    human_output(
        "\
openloop backend clear-cache — Stop backend and remove runtime cache

Usage:
  openloop backend clear-cache

Flags:
  --help    Show help",
    );
}

fn print_provision_help() {
    human_output(
        "\
openloop backend provision — Download and install the ACE-Step backend code

Usage:
  openloop backend provision [flags]

Flags:
  --json    JSON output
  --help    Show help",
    );
}

fn print_update_help() {
    human_output(
        "\
openloop backend update — Update the backend code to the latest version

Usage:
  openloop backend update [flags]

Flags:
  --json    JSON output
  --help    Show help",
    );
}
