use std::{fs, path::Path, sync::Arc};

use chrono::Utc;
use tauri::AppHandle;

use crate::{
    models::{
        errors::AppResult,
        settings::{AppSettings, ModelVariant},
    },
    services::model_bootstrap::{checkpoints_dir_for, descriptor_for},
};

use super::{
    download::{inspect_descriptor_for, part_path, publish_snapshot},
    manifest::{
        clear_delete_marker, read_manifest, variant_key, write_delete_marker, write_manifest,
    },
    specs::{pack_for_descriptor, unique_model_dirs},
    types::{AceModelDescriptor, ModelDownloadState, ModelStatusSnapshot},
};

/// Remove a variant's model files and partial downloads from the checkpoints dir.
pub fn remove_variant_files(
    app_data_dir: &Path,
    settings: &AppSettings,
    descriptor: &AceModelDescriptor,
) {
    let checkpoints_dir = checkpoints_dir_for(app_data_dir, settings);
    for spec in pack_for_descriptor(descriptor) {
        let target = checkpoints_dir.join(spec.local_path);
        if target.exists() {
            if let Err(e) = fs::remove_file(&target) {
                tracing::warn!("Failed to remove model file: {e}");
            }
        }
        let part = part_path(&target);
        if part.exists() {
            if let Err(e) = fs::remove_file(&part) {
                tracing::warn!("Failed to remove partial download: {e}");
            }
        }
    }
    for model_dir_name in unique_model_dirs(pack_for_descriptor(descriptor)) {
        let dir = checkpoints_dir.join(model_dir_name);
        let _ = fs::read_dir(&dir).map(|mut iter| {
            if iter.next().is_none() {
                if let Err(e) = fs::remove_dir(&dir) {
                    tracing::warn!("Failed to remove empty model directory: {e}");
                }
            }
        });
    }
}

/// Remove a single variant from the install manifest.
pub fn forget_variant_in_manifest(app_data_dir: &Path, variant: ModelVariant) {
    let mut manifest = read_manifest(app_data_dir).unwrap_or_default();
    manifest.installed.remove(&variant_key(variant));
    manifest.updated_at = Utc::now().to_rfc3339();
    let _ = write_manifest(app_data_dir, &manifest);
}

/// Delete partial (in-progress) downloads for a variant without touching installed files.
pub fn clear_partial_downloads(
    app_data_dir: &Path,
    settings: &AppSettings,
    variant: ModelVariant,
) -> AppResult<ModelStatusSnapshot> {
    let descriptor = descriptor_for(variant)?;
    let checkpoints_dir = checkpoints_dir_for(app_data_dir, settings);
    for spec in pack_for_descriptor(descriptor) {
        let target = checkpoints_dir.join(spec.local_path);
        let part = part_path(&target);
        if part.exists() {
            if let Err(e) = fs::remove_file(&part) {
                tracing::warn!("Failed to remove partial download: {e}");
            }
        }
    }
    Ok(inspect_descriptor_for(app_data_dir, settings, descriptor))
}

/// Remove all installed models listed in the manifest. Returns the post-state snapshots.
pub fn delete_all(app_data_dir: &Path, settings: &AppSettings) -> Vec<ModelStatusSnapshot> {
    let manifest = read_manifest(app_data_dir).unwrap_or_default();
    let variants_to_delete: Vec<ModelVariant> = manifest
        .installed
        .keys()
        .filter_map(|key| match key.as_str() {
            "lite" => Some(ModelVariant::Lite),
            "turbo" => Some(ModelVariant::Turbo),
            "pro" => Some(ModelVariant::Pro),
            _ => None,
        })
        .collect();

    for variant in &variants_to_delete {
        write_delete_marker(app_data_dir, *variant);
    }

    for variant in &variants_to_delete {
        let descriptor = match descriptor_for(*variant) {
            Ok(d) => d,
            Err(_) => continue,
        };
        remove_variant_files(app_data_dir, settings, descriptor);
        clear_delete_marker(app_data_dir, *variant);
    }

    let mut manifest = read_manifest(app_data_dir).unwrap_or_default();
    manifest.installed.clear();
    manifest.updated_at = Utc::now().to_rfc3339();
    let _ = write_manifest(app_data_dir, &manifest);

    // Re-inspect every known descriptor to build the post-state snapshots.
    super::ACE_MODEL_DESCRIPTORS
        .iter()
        .map(|descriptor| inspect_descriptor_for(app_data_dir, settings, descriptor))
        .collect()
}

/// Emit the "delete started" snapshot to the frontend so the UI flips to
/// NotInstalled before the async file removal completes.
pub fn emit_delete_started(
    app: &AppHandle,
    status: &Arc<std::sync::Mutex<Vec<ModelStatusSnapshot>>>,
    descriptor: &AceModelDescriptor,
) {
    let initial = ModelStatusSnapshot {
        variant: descriptor.variant,
        state: ModelDownloadState::NotInstalled,
        model_name: descriptor.model_name.to_owned(),
        label: descriptor.label.to_owned(),
        description: descriptor.description.to_owned(),
        downloaded_bytes: 0,
        total_bytes: Some(pack_for_descriptor(descriptor).iter().map(|f| f.size).sum()),
        installed_at: None,
        error: None,
    };
    publish_snapshot(app, status, initial);
}
