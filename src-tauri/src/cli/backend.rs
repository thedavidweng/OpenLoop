use std::process::Command;

use crate::{
    cli::{cli_error, events, human_output},
    models::{backend::BackendStatus, errors::AppResult},
    services::model_bootstrap::runtime_dir_for,
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
    let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
    let status = backend.status();

    let ownership = backend.ownership();

    if json {
        let mut output: serde_json::Value =
            serde_json::to_value(&status).map_err(|e| cli_error(e.to_string()))?;
        if let Some(obj) = output.as_object_mut() {
            obj.insert("ownership".to_owned(), serde_json::json!(ownership));
        }
        super::json_output(
            &serde_json::to_string_pretty(&output).map_err(|e| cli_error(e.to_string()))?,
        );
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

    if json {
        let output = serde_json::to_string_pretty(&status).map_err(|e| cli_error(e.to_string()))?;
        super::json_output(&output);
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

    Ok(())
}

// ---------------------------------------------------------------------------
// Stop
// ---------------------------------------------------------------------------

fn execute_stop(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = json_flag(args);
    let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
    let status = backend.stop()?;

    if json {
        let output = serde_json::to_string_pretty(&status).map_err(|e| cli_error(e.to_string()))?;
        super::json_output(&output);
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

    if json {
        let output = serde_json::to_string_pretty(&status).map_err(|e| cli_error(e.to_string()))?;
        super::json_output(&output);
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
        super::json_output(
            &serde_json::to_string_pretty(&output).map_err(|e| cli_error(e.to_string()))?,
        );
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
  status       Show backend health and port
  start        Start the backend
  stop         Stop the backend
  restart      Restart the backend
  logs         Print the backend logs path
  clear-cache  Stop backend and remove runtime cache

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
  openloop backend clear-cache",
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
