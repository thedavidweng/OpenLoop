use std::{fs, path::Path};

use crate::models::errors::{AppError, AppResult};

use super::types::{BackendManifest, BACKEND_MANIFEST_FILENAME};

pub fn read_backend_manifest(app_data_dir: &Path) -> Option<BackendManifest> {
    let path = app_data_dir.join("runtime").join(BACKEND_MANIFEST_FILENAME);
    let content = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

pub fn write_backend_manifest(app_data_dir: &Path, manifest: &BackendManifest) -> AppResult<()> {
    let dir = app_data_dir.join("runtime");
    fs::create_dir_all(&dir).map_err(|error| {
        AppError::backend_provision_failed(format!("failed to create runtime directory: {error}"))
    })?;
    let path = dir.join(BACKEND_MANIFEST_FILENAME);
    let payload = serde_json::to_string_pretty(manifest).map_err(|error| {
        AppError::backend_provision_failed(format!("failed to serialize manifest: {error}"))
    })?;
    fs::write(&path, &payload).map_err(|error| {
        AppError::backend_provision_failed(format!(
            "failed to write manifest {}: {error}",
            path.display()
        ))
    })?;
    Ok(())
}
