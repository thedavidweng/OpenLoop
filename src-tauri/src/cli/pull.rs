use crate::{
    cli::{cli_error, human_output},
    models::{errors::AppResult, settings::ModelVariant},
    services::model_manager::{read_manifest, ModelManager, ACE_MODEL_DESCRIPTORS},
};

use super::AppState;

pub fn execute(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = args.contains(&"--json".to_owned());
    let help = args.contains(&"--help".to_owned()) || args.contains(&"-h".to_owned());

    if help {
        print_help();
        return Ok(());
    }

    let model_arg = args
        .iter()
        .find(|arg| !arg.starts_with('-'))
        .ok_or_else(|| {
            cli_error("model variant is required. Usage: openloop pull <lite|turbo|pro>")
        })?;

    let variant = parse_variant(model_arg)?;

    let mut settings = state.db.get_settings()?;

    // CLI --mirror overrides saved setting for this run
    if let Some(mirror_idx) = args.iter().position(|a| a == "--mirror") {
        let mirror = args
            .get(mirror_idx + 1)
            .filter(|v| !v.starts_with('-'))
            .cloned();
        settings.model_mirror = mirror;
    }

    // Sync downloaded_models from manifest (may have been set by GUI or manual copy)
    if let Ok(manifest) = read_manifest(&state.app_data_dir) {
        let mut changed = false;
        for key in manifest.installed.keys() {
            let v = match key.as_str() {
                "lite" => Some(ModelVariant::Lite),
                "turbo" => Some(ModelVariant::Turbo),
                "pro" => Some(ModelVariant::Pro),
                _ => None,
            };
            if let Some(v) = v {
                if !settings.downloaded_models.contains(&v) {
                    settings.downloaded_models.push(v);
                    changed = true;
                }
            }
        }
        if changed {
            let _ = state.db.set_setting(
                "downloadedModels",
                serde_json::to_value(&settings.downloaded_models).unwrap_or_default(),
            );
        }
    }

    // Check if already downloaded
    if settings.downloaded_models.contains(&variant) {
        let label = variant_label(variant);
        if json {
            super::json_output(&format!(r#"{{"event":"completed","model":"{label}"}}"#));
        } else {
            human_output(&format!("✓ Model already downloaded: {label}"));
        }
        return Ok(());
    }

    let models = ModelManager::new(state.app_data_dir.clone());
    let descriptor = ACE_MODEL_DESCRIPTORS
        .iter()
        .find(|d| d.variant == variant)
        .ok_or_else(|| cli_error("unknown model variant"))?;

    // Download synchronously using a simple progress indicator
    // We need to start the backend first for ModelManager to work properly
    {
        let mut backend = state.backend.lock().map_err(|e| cli_error(e.to_string()))?;
        backend.status();
        let _ = backend.start(&settings);
    }

    let snapshot = models.download_blocking(&settings, variant)?;

    if json {
        super::json_output(&format!(
            r#"{{"event":"completed","model":"{}","total_bytes":{}}}"#,
            variant_label(variant),
            descriptor.estimated_size_bytes
        ));
    } else {
        human_output(&format!(
            "✓ Model downloaded: {} ({}GB)",
            variant_label(variant),
            descriptor.recommended_memory_gb
        ));
    }

    let _ = snapshot;
    Ok(())
}

fn parse_variant(arg: &str) -> AppResult<ModelVariant> {
    match arg.to_lowercase().as_str() {
        "lite" => Ok(ModelVariant::Lite),
        "turbo" => Ok(ModelVariant::Turbo),
        "pro" => Ok(ModelVariant::Pro),
        _ => Err(cli_error(format!(
            "unknown model '{}'. Available: lite, turbo, pro",
            arg
        ))),
    }
}

fn variant_label(variant: ModelVariant) -> &'static str {
    match variant {
        ModelVariant::Lite => "Lite",
        ModelVariant::Turbo => "Turbo",
        ModelVariant::Pro => "Pro",
    }
}

fn print_help() {
    human_output(
        "\
openloop pull — Download a model variant

Usage:
  openloop pull <lite|turbo|pro> [flags]

Flags:
  --mirror <URL>  Use a mirror source (e.g. https://www.modelscope.cn)
  --json          NDJSON progress output
  --help          Show help",
    );
}
