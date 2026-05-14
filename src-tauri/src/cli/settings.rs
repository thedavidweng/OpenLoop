use std::io::Write;

use crate::{
    cli::{cli_error, human_output},
    models::{errors::AppResult, settings::SettingKey},
};

use super::AppState;

pub fn execute(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = args.contains(&"--json".to_owned());
    let help = args.contains(&"--help".to_owned()) || args.contains(&"-h".to_owned());

    if help {
        print_help();
        return Ok(());
    }

    // First non-flag arg after skipping args[0] ("settings")
    let sub_pos = args.iter().skip(1).position(|a| !a.starts_with('-'));
    let subcommand = sub_pos.map(|p| args[p + 1].as_str());

    match subcommand {
        None | Some("get") | Some("show") => execute_get(state, json),
        Some("set") => execute_set(state, args, json),
        Some("reset") => execute_reset(state, args, json),
        Some("paths") => execute_paths(state, json),
        Some(other) => Err(cli_error(format!(
            "unknown subcommand '{}'.\n{}",
            other, "Available: get, show, set, reset, paths"
        ))),
    }
}

fn execute_get(state: &AppState, json: bool) -> AppResult<()> {
    let settings = state.db.get_settings()?;

    if json {
        let output =
            serde_json::to_string_pretty(&settings).map_err(|e| cli_error(e.to_string()))?;
        super::json_output(&output);
    } else {
        println!("{:<32} {}", "Setting", "Value");
        println!("{}", "-".repeat(72));
        println!("{:<32} {}", "Backend Port", settings.backend_port);
        println!(
            "{:<32} {}",
            "Model Variant",
            match settings.model_variant {
                Some(v) => format!("{:?}", v).to_lowercase(),
                None => "not set".to_owned(),
            }
        );
        println!(
            "{:<32} {}",
            "Default Duration (s)", settings.default_duration_seconds
        );
        println!(
            "{:<32} {}",
            "Default Audio Format", settings.default_audio_format
        );
        println!(
            "{:<32} {}",
            "Default Thinking",
            if settings.default_thinking {
                "on"
            } else {
                "off"
            }
        );
        println!(
            "{:<32} {}",
            "First Run Completed", settings.first_run_completed
        );
        if let Some(ref lang) = settings.language {
            println!("{:<32} {}", "Language", lang);
        }
        if let Some(ref dir) = settings.output_directory {
            println!("{:<32} {}", "Output Directory", dir);
        }
        if let Some(ref dir) = settings.model_directory {
            println!("{:<32} {}", "Model Directory", dir);
        }
        if let Some(ref dir) = settings.backend_working_directory {
            println!("{:<32} {}", "Backend Working Dir", dir);
        }
        if let Some(ref dir) = settings.log_directory {
            println!("{:<32} {}", "Log Directory", dir);
        }
    }

    Ok(())
}

fn execute_set(state: &AppState, args: &[String], json: bool) -> AppResult<()> {
    // Find the subcommand position in args
    let sub_pos = args
        .iter()
        .skip(1)
        .position(|a| !a.starts_with('-'))
        .ok_or_else(|| cli_error("missing subcommand"))?;

    let key = args
        .get(sub_pos + 2)
        .filter(|a| !a.starts_with('-'))
        .ok_or_else(|| cli_error("key is required.\nUsage: openloop settings set <key> <value>"))?;

    let value = args
        .get(sub_pos + 3)
        .filter(|a| !a.starts_with('-'))
        .ok_or_else(|| {
            cli_error("value is required.\nUsage: openloop settings set <key> <value>")
        })?;

    // Validate key via SettingKey before parsing value
    let setting_key = SettingKey::parse(key)?;

    let value_json = parse_setting_value(key, value)?;

    // Check if this setting impacts backend startup
    let note = if setting_key.impacts_backend_startup() {
        Some("Note: This setting affects the next backend start. The running backend is not restarted.")
    } else {
        None
    };

    state.db.set_setting(key, value_json)?;

    if json {
        let settings = state.db.get_settings()?;
        let output =
            serde_json::to_string_pretty(&settings).map_err(|e| cli_error(e.to_string()))?;
        super::json_output(&output);
    } else {
        human_output(&format!("✓ Setting '{key}' updated."));
        if let Some(msg) = note {
            human_output(&format!("  {msg}"));
        }
    }

    Ok(())
}

fn parse_setting_value(key: &str, value: &str) -> AppResult<serde_json::Value> {
    match key {
        "backendPort" => {
            let port: u16 = value.parse().map_err(|_| {
                cli_error(format!(
                    "'{key}' must be a valid port number, got '{value}'"
                ))
            })?;
            Ok(serde_json::json!(port))
        }
        "defaultDurationSeconds" => {
            let n: f64 = value.parse().map_err(|_| {
                cli_error(format!("'{key}' must be a number, got '{value}'"))
            })?;
            Ok(serde_json::json!(n))
        }
        "defaultAudioFormat" => match value.to_lowercase().as_str() {
            "wav" | "mp3" | "flac" | "ogg" => {
                Ok(serde_json::Value::String(value.to_lowercase()))
            }
            _ => Err(cli_error(format!(
                "invalid format '{value}'. Use wav, mp3, flac, or ogg."
            ))),
        },
        "defaultThinking" | "firstRunCompleted" | "checkForUpdates" => match value.to_lowercase().as_str() {
            "on" | "true" => Ok(serde_json::Value::Bool(true)),
            "off" | "false" => Ok(serde_json::Value::Bool(false)),
            _ => Err(cli_error(format!(
                "'{key}' must be on/off or true/false, got '{value}'"
            ))),
        },
        "modelVariant" => {
            let variant = match value.to_lowercase().as_str() {
                "lite" => crate::models::settings::ModelVariant::Lite,
                "turbo" => crate::models::settings::ModelVariant::Turbo,
                "pro" => crate::models::settings::ModelVariant::Pro,
                _ => {
                    return Err(cli_error(format!(
                        "invalid model variant '{value}'. Use lite, turbo, or pro."
                    )))
                }
            };
            serde_json::to_value(variant).map_err(|e| cli_error(e.to_string()))
        }
        "modelDirectory" | "outputDirectory" | "logDirectory" | "language" => {
            Ok(serde_json::Value::String(value.to_owned()))
        }
        _ => Err(cli_error(format!(
            "unknown setting key '{key}'. Available: backendPort, defaultDurationSeconds, defaultAudioFormat, defaultThinking, modelVariant, modelDirectory, outputDirectory, logDirectory, language, firstRunCompleted, checkForUpdates"
        ))),
    }
}

fn execute_reset(state: &AppState, args: &[String], json: bool) -> AppResult<()> {
    let yes = args.contains(&"--yes".to_owned());

    if !yes {
        eprintln!("This will reset runtime settings to their defaults:");
        eprintln!("  backendPort → 8001");
        eprintln!("  modelDirectory → (unset)");
        eprintln!("  backendWorkingDirectory → (unset)");
        eprintln!("  logDirectory → (unset)");
        eprint!("Are you sure? [y/N]: ");
        std::io::stdout().flush().ok();
        let mut input = String::new();
        std::io::stdin().read_line(&mut input).ok();
        if !input.trim().eq_ignore_ascii_case("y") {
            human_output("Cancelled.");
            return Ok(());
        }
    }

    let resets = [
        ("backendPort", serde_json::json!(8001)),
        ("modelDirectory", serde_json::Value::Null),
        ("backendWorkingDirectory", serde_json::Value::Null),
        ("logDirectory", serde_json::Value::Null),
    ];

    for (key, value) in resets {
        state.db.set_setting(key, value)?;
    }

    if json {
        let settings = state.db.get_settings()?;
        let output =
            serde_json::to_string_pretty(&settings).map_err(|e| cli_error(e.to_string()))?;
        super::json_output(&output);
    } else {
        human_output("✓ Runtime settings reset to defaults.");
    }

    Ok(())
}

fn execute_paths(state: &AppState, json: bool) -> AppResult<()> {
    let app_data_dir = &state.app_data_dir;

    let output_directory = std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .map(|home| home.join("Music").join("OpenLoop"))
        .unwrap_or_else(|| app_data_dir.join("generated-audio"));

    let model_directory = app_data_dir.join("models").join("checkpoints");
    let log_directory = app_data_dir.join("logs").join("backend");

    if json {
        let paths = serde_json::json!({
            "outputDirectory": output_directory.display().to_string(),
            "modelDirectory": model_directory.display().to_string(),
            "logDirectory": log_directory.display().to_string(),
        });
        super::json_output(
            &serde_json::to_string_pretty(&paths).map_err(|e| cli_error(e.to_string()))?,
        );
    } else {
        println!("{:<32} {}", "Path", "Location");
        println!("{}", "-".repeat(72));
        println!("{:<32} {}", "Output Directory", output_directory.display());
        println!("{:<32} {}", "Model Directory", model_directory.display());
        println!("{:<32} {}", "Log Directory", log_directory.display());
    }

    Ok(())
}

fn print_help() {
    human_output(
        "\
openloop settings — View and modify application settings

Usage:
  openloop settings <subcommand> [flags]

Subcommands:
  get, show             Show all settings
  set <key> <value>     Set a setting value
  reset                 Reset runtime settings to defaults (requires --yes)
  paths                 Show default application paths

Flags:
  --json    JSON output
  --yes     Skip confirmation for destructive operations
  --help    Show help

Settings keys:
  backendPort             Backend server port (number)
  defaultDurationSeconds  Default generation duration (number)
  defaultAudioFormat      Audio format (wav, mp3, flac, ogg)
  defaultThinking         Enable thinking mode (on/off, true/false)
  modelVariant            Model variant (lite, turbo, pro)
  modelDirectory          Model storage path (string)
  outputDirectory         Output directory path (string)
  logDirectory            Log directory path (string)
  language                Language (string)
  firstRunCompleted       First run completed (true/false)
  checkForUpdates         Check for updates on startup (on/off, true/false)",
    );
}
