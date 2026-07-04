use crate::{
    cli::{cli_error, human_output},
    models::{errors::AppResult, settings::ModelVariant},
    services::model_manager::{read_manifest, ModelManager, ACE_MODEL_DESCRIPTORS},
};

use super::AppState;

pub fn execute(state: &AppState, json: bool, args: crate::cli::spec::PullArgs) -> AppResult<()> {
    let variant: ModelVariant = args.model.into();

    let mut settings = state.db.get_settings()?;

    // CLI --mirror overrides saved setting for this run (can be specified multiple times)
    if !args.mirror.is_empty() {
        settings.model_mirrors = args.mirror.clone();
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

    let models = ModelManager::new(
        state.app_data_dir.clone(),
        std::sync::Arc::clone(&state.network_log),
    );
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

fn variant_label(variant: ModelVariant) -> &'static str {
    match variant {
        ModelVariant::Lite => "Lite",
        ModelVariant::Turbo => "Turbo",
        ModelVariant::Pro => "Pro",
    }
}
