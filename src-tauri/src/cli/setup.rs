use crate::{
    cli::{cli_error, human_output},
    models::{
        errors::AppResult,
        settings::{AppSettings, ModelVariant, SettingKey},
    },
};

use super::AppState;
use crate::cli::spec::SetupArgs;
use std::io::IsTerminal;

pub fn execute(state: &AppState, json: bool, args: SetupArgs) -> AppResult<()> {
    let flag_model = args.model;
    let flag_thinking = args.thinking;
    let flag_duration = args.duration;
    let flag_format = args.format;
    let positional_key = args.key;
    let positional_value = args.value;

    let has_flags = flag_model.is_some()
        || flag_thinking.is_some()
        || flag_duration.is_some()
        || flag_format.is_some();

    if let Some(key) = positional_key.as_deref() {
        // KEY VALUE mode
        if positional_value.is_none() {
            // Show single value
            let settings = state.db.get_settings()?;
            let value = get_setting_value(&settings, key)?;
            if json {
                super::json_output(&format!(r#"{{"{key}":"{value}"}}"#));
            } else {
                human_output(&format!("{key} = {value}"));
            }
            return Ok(());
        }

        let value = positional_value.as_deref().unwrap();
        set_setting(state, key, value)?;

        let updated = state.db.get_settings()?;
        if json {
            print_settings_json(&updated);
        } else {
            human_output(&format!("✓ Set {key} = {value}"));
        }
    } else if has_flags {
        // Flag-based setting
        if let Some(v) = flag_model {
            set_setting(state, "model", &v)?;
        }
        if let Some(v) = flag_thinking {
            set_setting(state, "thinking", &v)?;
        }
        if let Some(v) = flag_duration {
            set_setting(state, "duration", &v.to_string())?;
        }
        if let Some(v) = flag_format {
            set_setting(state, "format", &v)?;
        }

        let updated = state.db.get_settings()?;
        if json {
            print_settings_json(&updated);
        } else {
            human_output("✓ Settings updated.");
        }
    } else {
        // Interactive or show all
        let is_tty = std::io::stdin().is_terminal();
        if !is_tty || json {
            // Non-interactive: show all settings
            let settings = state.db.get_settings()?;
            if json {
                print_settings_json(&settings);
            } else {
                print_settings_table(&settings);
            }
        } else {
            // Interactive wizard
            run_interactive_wizard(state)?;
        }
    }

    Ok(())
}

fn run_interactive_wizard(state: &AppState) -> AppResult<()> {
    use dialoguer::{Input, Select};

    human_output("");
    human_output("┌─────────────────────────────────────────┐");
    human_output("│         ♫ OpenLoop Setup                │");
    human_output("│  Configure model and generation defaults │");
    human_output("│  Press Ctrl+C to exit                   │");
    human_output("└─────────────────────────────────────────┘");
    human_output("");

    let settings = state.db.get_settings()?;
    let current_model = settings.model_variant.unwrap_or(ModelVariant::Turbo);

    // Model variant
    human_output("◆ Model Variant");
    human_output("  Select the model to use for generation.");
    let model_items = &["Turbo (16GB)", "Lite (8GB)", "Pro (24GB)"];
    let default_idx = match current_model {
        ModelVariant::Turbo => 0,
        ModelVariant::Lite => 1,
        ModelVariant::Pro => 2,
    };
    let model_selection = Select::new()
        .with_prompt(format!(
            "  Current: {} ({})",
            current_model.label(),
            variant_gb(current_model)
        ))
        .items(model_items)
        .default(default_idx)
        .interact()
        .map_err(|e| cli_error(e.to_string()))?;
    let new_variant = match model_selection {
        0 => ModelVariant::Turbo,
        1 => ModelVariant::Lite,
        2 => ModelVariant::Pro,
        _ => current_model,
    };
    set_setting_raw(
        state,
        SettingKey::ModelVariant,
        serde_json::to_value(new_variant).map_err(|e| cli_error(e.to_string()))?,
    )?;
    human_output("");

    // Thinking mode
    human_output("◆ Thinking Mode");
    human_output("  Enable reasoning for better prompt understanding.");
    let thinking_items = &["Enabled", "Disabled"];
    let thinking_idx = if settings.default_thinking { 0 } else { 1 };
    let thinking_selection = Select::new()
        .with_prompt(format!(
            "  Current: {}",
            if settings.default_thinking {
                "enabled"
            } else {
                "disabled"
            }
        ))
        .items(thinking_items)
        .default(thinking_idx)
        .interact()
        .map_err(|e| cli_error(e.to_string()))?;
    set_setting(
        state,
        "thinking",
        if thinking_selection == 0 { "on" } else { "off" },
    )?;
    human_output("");

    // Default duration
    human_output("◆ Default Duration");
    human_output("  Default duration in seconds for generated audio.");
    let current_duration = settings.default_duration_seconds as i64;
    let duration: i64 = Input::new()
        .with_prompt(format!("  Current: {current_duration}"))
        .default(current_duration)
        .interact_text()
        .map_err(|e| cli_error(e.to_string()))?;
    if (10..=600).contains(&duration) {
        set_setting(state, "duration", &duration.to_string())?;
    } else {
        human_output("  Must be between 10 and 600. Keeping current value.");
    }
    human_output("");

    // Audio format
    human_output("◆ Audio Format");
    human_output("  Default output format for generated audio.");
    let format_items = &[
        "wav — uncompressed, largest file",
        "mp3 — compressed, smallest file",
        "flac — lossless compression",
        "ogg — lossy compression",
    ];
    let format_idx = match settings.default_audio_format.as_str() {
        "wav" => 0,
        "mp3" => 1,
        "flac" => 2,
        "ogg" => 3,
        _ => 0,
    };
    let format_selection = Select::new()
        .with_prompt(format!("  Current: {}", settings.default_audio_format))
        .items(format_items)
        .default(format_idx)
        .interact()
        .map_err(|e| cli_error(e.to_string()))?;
    let new_format = match format_selection {
        0 => "wav",
        1 => "mp3",
        2 => "flac",
        3 => "ogg",
        _ => "wav",
    };
    set_setting(state, "format", new_format)?;
    human_output("");

    human_output("✓ Setup complete. Settings saved.");
    Ok(())
}

fn set_setting(state: &AppState, key: &str, value: &str) -> AppResult<()> {
    let value_json = match key {
        "model" => {
            let variant = match value.to_lowercase().as_str() {
                "lite" => ModelVariant::Lite,
                "turbo" => ModelVariant::Turbo,
                "pro" => ModelVariant::Pro,
                _ => {
                    return Err(cli_error(format!(
                        "invalid model '{}'. Use lite, turbo, or pro.",
                        value
                    )))
                }
            };
            serde_json::to_value(variant).map_err(|e| cli_error(e.to_string()))?
        }
        "thinking" => serde_json::Value::Bool(parse_bool_flag(value, "thinking")?),
        "duration" => {
            let d: f64 = value.parse().map_err(|_| {
                cli_error(format!("invalid duration '{}'. Must be a number.", value))
            })?;
            if !(10.0..=600.0).contains(&d) {
                return Err(cli_error("duration must be between 10 and 600"));
            }
            serde_json::json!(d)
        }
        "format" => match value.to_lowercase().as_str() {
            "wav" | "mp3" | "flac" | "ogg" => serde_json::Value::String(value.to_lowercase()),
            _ => {
                return Err(cli_error(format!(
                    "invalid format '{}'. Use wav, mp3, flac, or ogg.",
                    value
                )))
            }
        },
        "checkForUpdates" => serde_json::Value::Bool(parse_bool_flag(value, "checkForUpdates")?),
        _ => {
            return Err(cli_error(format!(
            "unknown setting '{}'. Available: model, thinking, duration, format, checkForUpdates",
            key
        )))
        }
    };

    set_setting_raw(
        state,
        SettingKey::parse(setting_key_for_cli(key))?,
        value_json,
    )
}

fn setting_key_for_cli(cli_key: &str) -> &str {
    match cli_key {
        "model" => "modelVariant",
        "thinking" => "defaultThinking",
        "duration" => "defaultDurationSeconds",
        "format" => "defaultAudioFormat",
        _ => cli_key,
    }
}

fn set_setting_raw(state: &AppState, key: SettingKey, value: serde_json::Value) -> AppResult<()> {
    let impacts = key.impacts_backend_startup();
    state.db.set_setting(key.as_str(), value)?;

    if impacts {
        human_output("  Note: This setting affects the next backend start. The running backend is not restarted.");
    }

    Ok(())
}

fn parse_bool_flag(value: &str, name: &str) -> AppResult<bool> {
    match value.to_lowercase().as_str() {
        "on" | "true" | "1" | "yes" | "enabled" => Ok(true),
        "off" | "false" | "0" | "no" | "disabled" => Ok(false),
        _ => Err(cli_error(format!(
            "invalid {name} value '{value}'. Use on/off."
        ))),
    }
}

fn get_setting_value(settings: &AppSettings, key: &str) -> AppResult<String> {
    match key {
        "model" => Ok(model_str(settings).to_owned()),
        "thinking" => Ok(on_off(settings.default_thinking).to_owned()),
        "duration" => Ok(settings.default_duration_seconds.to_string()),
        "format" => Ok(settings.default_audio_format.clone()),
        "checkForUpdates" => Ok(on_off(settings.check_for_updates).to_owned()),
        _ => Err(cli_error(format!("unknown setting '{}'", key))),
    }
}

fn on_off(value: bool) -> &'static str {
    if value {
        "on"
    } else {
        "off"
    }
}

fn model_str(settings: &AppSettings) -> &str {
    settings.model_variant.map_or("none", ModelVariant::as_str)
}

fn print_settings_json(settings: &AppSettings) {
    let json = serde_json::json!({
        "model": model_str(settings),
        "thinking": on_off(settings.default_thinking),
        "duration": settings.default_duration_seconds.to_string(),
        "format": settings.default_audio_format,
        "checkForUpdates": on_off(settings.check_for_updates),
    });
    super::json_output(&serde_json::to_string_pretty(&json).unwrap_or_default());
}

fn print_settings_table(settings: &AppSettings) {
    let model = model_str(settings);
    let thinking = on_off(settings.default_thinking);
    let check_updates = on_off(settings.check_for_updates);

    human_output(&format!("model              = {model}"));
    human_output(&format!("thinking           = {thinking}"));
    human_output(&format!(
        "duration           = {}",
        settings.default_duration_seconds as i64
    ));
    human_output(&format!(
        "format             = {}",
        settings.default_audio_format
    ));
    human_output(&format!("checkForUpdates    = {check_updates}"));
}

fn variant_gb(v: ModelVariant) -> &'static str {
    match v {
        ModelVariant::Lite => "8GB",
        ModelVariant::Turbo => "16GB",
        ModelVariant::Pro => "24GB",
    }
}
