use std::{
    fs,
    path::{Path, PathBuf},
};

use chrono::Utc;

use crate::{
    models::{errors::AppResult, settings::ModelVariant},
    services::model_bootstrap::checkpoints_dir_for,
};

use super::download::part_path;
use super::{
    specs::{pack_for_descriptor, unique_model_dirs},
    types::{AceModelDescriptor, InstalledModelManifest, ModelFileSpec, ModelManifest},
    ACE_MODEL_DESCRIPTORS,
};

/// Resolve the on-disk path of the install manifest.
pub fn manifest_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir
        .join("models")
        .join("openloop-ace-manifest.json")
}

/// Read the install manifest, returning an empty default when it is absent.
pub fn read_manifest(app_data_dir: &Path) -> AppResult<ModelManifest> {
    let path = manifest_path(app_data_dir);
    if !path.exists() {
        return Ok(ModelManifest::default());
    }
    let payload = fs::read_to_string(&path).map_err(|error| {
        crate::models::errors::AppError::model_not_found(format!(
            "failed to read model manifest {}: {error}",
            path.display()
        ))
    })?;
    serde_json::from_str(&payload).map_err(|error| {
        crate::models::errors::AppError::model_not_found(format!(
            "failed to parse model manifest {}: {error}",
            path.display()
        ))
    })
}

/// Persist the install manifest to disk.
pub fn write_manifest(app_data_dir: &Path, manifest: &ModelManifest) -> AppResult<()> {
    let path = manifest_path(app_data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            crate::models::errors::AppError::model_not_found(format!(
                "failed to create model manifest directory {}: {error}",
                parent.display()
            ))
        })?;
    }
    let payload = serde_json::to_string_pretty(manifest)
        .map_err(|error| crate::models::errors::AppError::model_not_found(error.to_string()))?;
    fs::write(&path, payload).map_err(|error| {
        crate::models::errors::AppError::model_not_found(format!(
            "failed to write model manifest {}: {error}",
            path.display()
        ))
    })
}

/// Record that a model pack was installed by upserting its entry into the manifest.
pub fn record_install(app_data_dir: &Path, descriptor: &AceModelDescriptor) -> AppResult<()> {
    let mut manifest = read_manifest(app_data_dir).unwrap_or_default();
    manifest.updated_at = Utc::now().to_rfc3339();
    manifest.installed.insert(
        variant_key(descriptor.variant),
        InstalledModelManifest {
            model_name: descriptor.model_name.to_owned(),
            lm_model: descriptor.lm_model.map(str::to_owned),
            installed_at: Utc::now().to_rfc3339(),
        },
    );
    write_manifest(app_data_dir, &manifest)
}

/// Stable manifest key for a model variant.
pub fn variant_key(variant: ModelVariant) -> String {
    match variant {
        ModelVariant::Lite => "lite",
        ModelVariant::Turbo => "turbo",
        ModelVariant::Pro => "pro",
    }
    .to_owned()
}

// ---------------------------------------------------------------------------
// Delete markers (coordination between delete_all and resume_pending_deletions)
// ---------------------------------------------------------------------------

pub fn delete_marker_path(app_data_dir: &Path, variant: ModelVariant) -> PathBuf {
    app_data_dir
        .join("models")
        .join(format!(".openloop-deleting-{}", variant_key(variant)))
}

pub fn write_delete_marker(app_data_dir: &Path, variant: ModelVariant) {
    let path = delete_marker_path(app_data_dir, variant);
    if let Some(parent) = path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            tracing::warn!("Failed to create delete marker directory: {e}");
        }
    }
    if let Err(e) = fs::write(&path, Utc::now().to_rfc3339()) {
        tracing::warn!("Failed to write delete marker: {e}");
    }
}

pub fn clear_delete_marker(app_data_dir: &Path, variant: ModelVariant) {
    if let Err(e) = fs::remove_file(delete_marker_path(app_data_dir, variant)) {
        if e.kind() != std::io::ErrorKind::NotFound {
            tracing::warn!("Failed to clear delete marker: {e}");
        }
    }
}

pub fn read_delete_marker(app_data_dir: &Path, variant: ModelVariant) -> bool {
    delete_marker_path(app_data_dir, variant).exists()
}

/// Remove any model files left behind by a delete that was interrupted before
/// it could finish cleaning up. Runs once at ModelManager construction.
pub fn resume_pending_deletions(
    app_data_dir: &std::path::Path,
    settings: &crate::models::settings::AppSettings,
) {
    for descriptor in ACE_MODEL_DESCRIPTORS {
        if read_delete_marker(app_data_dir, descriptor.variant) {
            let checkpoints_dir = checkpoints_dir_for(app_data_dir, settings);
            for spec in pack_for_descriptor(descriptor) {
                let target = checkpoints_dir.join(spec.local_path);
                if target.exists() {
                    if let Err(e) = fs::remove_file(&target) {
                        tracing::warn!("Failed to remove model file during resume: {e}");
                    }
                }
                let part = part_path(&target);
                if part.exists() {
                    if let Err(e) = fs::remove_file(&part) {
                        tracing::warn!("Failed to remove partial download during resume: {e}");
                    }
                }
            }
            for model_dir_name in unique_model_dirs(pack_for_descriptor(descriptor)) {
                let dir = checkpoints_dir.join(model_dir_name);
                let _ = fs::read_dir(&dir).map(|mut iter| {
                    if iter.next().is_none() {
                        if let Err(e) = fs::remove_dir(&dir) {
                            tracing::warn!(
                                "Failed to remove empty model directory during resume: {e}"
                            );
                        }
                    }
                });
            }
            if let Ok(mut manifest) = read_manifest(app_data_dir) {
                manifest.installed.remove(&variant_key(descriptor.variant));
                manifest.updated_at = Utc::now().to_rfc3339();
                let _ = write_manifest(app_data_dir, &manifest);
            }
            clear_delete_marker(app_data_dir, descriptor.variant);
        }
    }
}

#[allow(dead_code)]
fn _suppress_unused(spec: &ModelFileSpec) {
    // Keeps the ModelFileSpec import referenced when compile-time checks vary.
    let _ = spec.local_path;
}
