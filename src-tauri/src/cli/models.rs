use std::fs;
use std::io::Write;
use std::sync::Arc;

use chrono::Utc;

use crate::{
    cli::{cli_error, human_output},
    models::{errors::AppResult, settings::ModelVariant},
    services::{
        model_bootstrap::{checkpoints_dir_for, descriptor_for},
        model_catalog::{self, PackInstallPolicy},
        model_manager::{read_manifest, ModelManager, ACE_MODEL_DESCRIPTORS},
    },
};

use super::AppState;
use crate::cli::spec::ModelsCommand;

pub fn execute(state: &AppState, json: bool, command: Option<ModelsCommand>) -> AppResult<()> {
    match command.unwrap_or(ModelsCommand::List) {
        ModelsCommand::List => execute_list(state, json),
        ModelsCommand::Download { variant } => execute_download(state, json, variant.into()),
        ModelsCommand::Delete { variant } => execute_delete(state, json, variant.into()),
        ModelsCommand::Cancel { variant } => execute_cancel(state, json, variant.into()),
        ModelsCommand::ClearPartial { variant } => {
            execute_clear_partial(state, json, variant.into())
        }
        ModelsCommand::DeleteAll { yes } => execute_delete_all(state, json, yes),
    }
}

fn execute_list(state: &AppState, json: bool) -> AppResult<()> {
    let mut settings = state.db.get_settings()?;

    // Sync downloaded_models from manifest if it has entries the DB is missing
    if let Ok(manifest) = read_manifest(&state.app_data_dir) {
        let mut changed = false;
        for key in manifest.installed.keys() {
            let variant = match key.as_str() {
                "lite" => Some(ModelVariant::Lite),
                "turbo" => Some(ModelVariant::Turbo),
                "pro" => Some(ModelVariant::Pro),
                _ => None,
            };
            if let Some(v) = variant {
                if !settings.downloaded_models.contains(&v) {
                    settings.downloaded_models.push(v);
                    changed = true;
                }
            }
        }
        if changed {
            if let Err(e) = state.db.set_setting(
                "downloadedModels",
                serde_json::to_value(&settings.downloaded_models)
                    .map_err(|e| cli_error(e.to_string()))?,
            ) {
                eprintln!(
                    "{}",
                    crate::cli::warning_output::persist_downloaded_models_warning(&e)
                );
            }
        }
    }

    let active_slot = model_catalog::selected_slot_id(&settings);

    if json {
        let mut items = Vec::new();
        for descriptor in ACE_MODEL_DESCRIPTORS {
            let is_downloaded = settings.downloaded_models.contains(&descriptor.variant);
            let slot = model_catalog::slot_for_ace_variant(descriptor.variant);
            let is_active = active_slot.as_deref() == Some(slot.id);

            items.push(serde_json::json!({
                "id": slot.id,
                "engine": slot.engine.as_str(),
                "pack": slot.pack_id,
                "variant": descriptor.variant.as_str(),
                "size_gb": descriptor.recommended_memory_gb,
                "status": if is_downloaded { "downloaded" } else { "not_downloaded" },
                "active": is_active,
                "selectable": slot.selectable,
            }));
        }
        for pack in model_catalog::CATALOG_PACKS {
            if pack.ace_pack.is_some() {
                continue;
            }
            items.push(serde_json::json!({
                "id": pack.id,
                "engine": pack.engine.as_str(),
                "pack": pack.id,
                "variant": serde_json::Value::Null,
                "size_gb": pack.recommended_memory_gb,
                "status": match pack.install_policy {
                    PackInstallPolicy::Installable => "not_downloaded",
                    PackInstallPolicy::Announced => "announced",
                },
                "active": active_slot.as_deref() == Some(pack.id),
                "selectable": false,
            }));
        }
        let output = serde_json::to_string_pretty(&items).map_err(|e| cli_error(e.to_string()))?;
        super::json_output(&output);
    } else {
        println!(
            "{:<18} {:<24} {:<12} Description",
            r#"Engine"#, r#"Slot"#, r#"Status"#
        );
        let separator = "-".repeat(86);
        println!("{separator}");

        for descriptor in ACE_MODEL_DESCRIPTORS {
            let is_downloaded = settings.downloaded_models.contains(&descriptor.variant);
            let slot = model_catalog::slot_for_ace_variant(descriptor.variant);
            let is_active = active_slot.as_deref() == Some(slot.id);

            let status = if is_active {
                "● active"
            } else if is_downloaded {
                "downloaded"
            } else {
                "—"
            };

            println!(
                "{:<18} {:<24} {:<12} {}",
                slot.engine.as_str(),
                slot.id,
                status,
                descriptor.description
            );
        }
        for pack in model_catalog::CATALOG_PACKS {
            if pack.ace_pack.is_some() {
                continue;
            }
            println!(
                "{:<18} {:<24} {:<12} {}",
                pack.engine.as_str(),
                pack.id,
                "announced",
                pack.description
            );
        }
    }

    Ok(())
}

fn execute_download(state: &AppState, json: bool, variant: ModelVariant) -> AppResult<()> {
    let settings = state.db.get_settings()?;

    if settings.downloaded_models.contains(&variant) {
        let label = variant.label();
        if json {
            super::json_output(&format!(r#"{{"event":"completed","model":"{label}"}}"#));
        } else {
            human_output(&format!("✓ Model already downloaded: {label}"));
        }
        return Ok(());
    }

    if !json {
        human_output(&format!("↓ Downloading {} ...", variant.label()));
    }

    let models = ModelManager::new(state.app_data_dir.clone(), Arc::clone(&state.network_log));
    models.download_blocking(&settings, variant)?;

    // Persist the downloaded model in settings so the list reflects it
    let mut settings = state.db.get_settings()?;
    if !settings.downloaded_models.contains(&variant) {
        settings.downloaded_models.push(variant);
        state.db.set_setting(
            "downloadedModels",
            serde_json::to_value(&settings.downloaded_models)
                .map_err(|e| cli_error(e.to_string()))?,
        )?;
    }

    if json {
        super::json_output(&format!(
            r#"{{"event":"completed","model":"{}"}}"#,
            variant.label()
        ));
    } else {
        human_output(&format!("✓ Model downloaded: {}", variant.label()));
    }

    Ok(())
}

fn execute_delete(state: &AppState, json: bool, variant: ModelVariant) -> AppResult<()> {
    let settings = state.db.get_settings()?;
    let descriptor = descriptor_for(variant)?;
    let checkpoints_dir = checkpoints_dir_for(&state.app_data_dir, &settings);

    // Remove model-specific checkpoint directories
    let model_dir = checkpoints_dir.join(descriptor.model_name);
    if model_dir.exists() {
        fs::remove_dir_all(&model_dir).map_err(|e| {
            cli_error(format!(
                "failed to remove model directory '{}': {e}",
                model_dir.display()
            ))
        })?;
    }

    if let Some(lm) = descriptor.lm_model {
        let lm_dir = checkpoints_dir.join(lm);
        if lm_dir.exists() {
            fs::remove_dir_all(&lm_dir).map_err(|e| {
                cli_error(format!(
                    "failed to remove language model directory '{}': {e}",
                    lm_dir.display()
                ))
            })?;
        }
    }

    // Update the install manifest
    let manifest_dir = state.app_data_dir.join("models");
    let manifest_path = manifest_dir.join("openloop-ace-manifest.json");
    if manifest_path.exists() {
        let content = fs::read_to_string(&manifest_path)
            .map_err(|e| cli_error(format!("failed to read manifest: {e}")))?;
        let mut manifest: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| cli_error(format!("failed to parse manifest: {e}")))?;
        if let Some(obj) = manifest.as_object_mut() {
            if let Some(installed) = obj.get_mut("installed").and_then(|v| v.as_object_mut()) {
                installed.remove(variant.as_str());
            }
            obj.insert(
                "updatedAt".to_string(),
                serde_json::Value::String(Utc::now().to_rfc3339()),
            );
        }
        let payload = serde_json::to_string_pretty(&manifest)
            .map_err(|e| cli_error(format!("failed to serialize manifest: {e}")))?;
        fs::write(&manifest_path, &payload)
            .map_err(|e| cli_error(format!("failed to write manifest: {e}")))?;
    }

    // Update settings
    let mut settings = state.db.get_settings()?;
    settings.downloaded_models.retain(|v| *v != variant);
    state.db.set_setting(
        "downloadedModels",
        serde_json::to_value(&settings.downloaded_models).map_err(|e| cli_error(e.to_string()))?,
    )?;

    if json {
        super::json_output(&format!(
            r#"{{"event":"deleted","model":"{}"}}"#,
            variant.label()
        ));
    } else {
        human_output(&format!("✓ Model deleted: {}", variant.label()));
    }

    Ok(())
}

fn execute_cancel(state: &AppState, json: bool, variant: ModelVariant) -> AppResult<()> {
    let manager = state
        .models
        .lock()
        .map_err(|_| cli_error("model manager lock poisoned"))?;
    manager.cancel_download(variant)?;

    if json {
        super::json_output(&format!(
            r#"{{"event":"cancelled","model":"{}"}}"#,
            variant.label()
        ));
    } else {
        human_output(&format!("✓ Download cancelled: {}", variant.label()));
    }

    Ok(())
}

fn execute_clear_partial(state: &AppState, json: bool, variant: ModelVariant) -> AppResult<()> {
    let settings = state.db.get_settings()?;
    let manager = state
        .models
        .lock()
        .map_err(|_| cli_error("model manager lock poisoned"))?;
    let _snapshot = manager.clear_partial_downloads(&settings, variant)?;

    if json {
        super::json_output(&format!(
            r#"{{"event":"cleared","model":"{}"}}"#,
            variant.label()
        ));
    } else {
        human_output(&format!("✓ Partial downloads cleared: {}", variant.label()));
    }

    Ok(())
}

fn execute_delete_all(state: &AppState, json: bool, yes: bool) -> AppResult<()> {
    let settings = state.db.get_settings()?;
    let count = settings.downloaded_models.len();

    if count == 0 {
        if json {
            super::json_output(r#"{"event":"deleted_all","count":0}"#);
        } else {
            human_output("No models to delete.");
        }
        return Ok(());
    }

    if !yes {
        eprintln!("This will delete {count} downloaded model(s) and their local files.");
        eprint!("Are you sure? [y/N]: ");
        std::io::stdout().flush().ok();
        let mut input = String::new();
        std::io::stdin()
            .read_line(&mut input)
            .map_err(|e| cli_error(format!("failed to read confirmation: {e}")))?;
        if !input.trim().eq_ignore_ascii_case("y") {
            human_output("Cancelled.");
            return Ok(());
        }
    }

    let manager = state
        .models
        .lock()
        .map_err(|_| cli_error("model manager lock poisoned"))?;
    let snapshots = manager.delete_all(&settings);

    // Clear downloaded models from settings
    let mut settings = state.db.get_settings()?;
    settings.downloaded_models.clear();
    state.db.set_setting(
        "downloadedModels",
        serde_json::to_value(&settings.downloaded_models).map_err(|e| cli_error(e.to_string()))?,
    )?;

    if json {
        super::json_output(&format!(
            r#"{{"event":"deleted_all","count":{}}}"#,
            snapshots.len()
        ));
    } else {
        human_output(&format!("✓ All models deleted ({} total)", snapshots.len()));
    }

    Ok(())
}
