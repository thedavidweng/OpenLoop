use std::{
    fs,
    path::Path,
    sync::{Arc, Mutex},
};

use tauri::{AppHandle, Emitter};

use crate::models::errors::{AppError, AppResult};

use super::types::{BackendProvisionStatus, BACKEND_MANIFEST_FILENAME, BACKEND_PROVISION_EVENT};

pub fn backup_runtime_code(runtime_dir: &Path, backup_dir: &Path) -> AppResult<()> {
    fs::create_dir_all(backup_dir).map_err(|error| {
        AppError::backend_provision_failed(format!("failed to create backup directory: {error}"))
    })?;

    let backup_name = backup_dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    // Move Python source files to backup, preserving checkpoints symlink
    let entries: Vec<_> = fs::read_dir(runtime_dir)
        .map_err(|error| {
            AppError::backend_provision_failed(format!("failed to read runtime directory: {error}"))
        })?
        .filter_map(|e| e.ok())
        .collect();

    for entry in &entries {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        // Skip checkpoints symlink, manifest, backup dir, and cache
        if name_str == "checkpoints"
            || name_str == BACKEND_MANIFEST_FILENAME
            || name_str == backup_name
            || name_str == ".cache"
        {
            continue;
        }
        let src = entry.path();
        let dst = backup_dir.join(&name);
        fs::rename(&src, &dst).map_err(|error| {
            AppError::backend_provision_failed(format!(
                "failed to backup {}: {error}",
                src.display()
            ))
        })?;
    }

    Ok(())
}

pub fn emit_status(app: &AppHandle, status: &Arc<Mutex<BackendProvisionStatus>>) {
    if let Ok(s) = status.lock() {
        if let Err(error) = app.emit(BACKEND_PROVISION_EVENT, s.clone()) {
            tracing::warn!("{}", provision_status_emit_warning(&error));
        }
    }
}

pub fn manifest_migration_warning(error: &AppError) -> String {
    format!(
        "failed to write backend manifest during migration: {}",
        error.message
    )
}

pub fn provision_status_emit_warning(error: &impl std::fmt::Display) -> String {
    format!("failed to emit backend provision status: {error}")
}
