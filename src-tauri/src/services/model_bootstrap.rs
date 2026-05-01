use std::{
    fs,
    path::{Path, PathBuf},
};

#[cfg(unix)]
use std::os::unix::fs as unix_fs;

use chrono::Utc;

use crate::{
    models::{
        errors::{AppError, AppResult},
        settings::{AppSettings, ModelVariant},
    },
    services::model_manager::{AceModelDescriptor, ACE_MODEL_DESCRIPTORS},
};

#[derive(Debug, Clone)]
pub struct RuntimeLayout {
    pub descriptor: &'static AceModelDescriptor,
    pub working_directory: PathBuf,
    pub checkpoints_directory: PathBuf,
}

pub fn prepare_runtime_layout(
    app_data_dir: &Path,
    settings: &AppSettings,
) -> AppResult<RuntimeLayout> {
    let selected_variant = settings.model_variant.ok_or_else(|| {
        AppError::model_not_found("select and download a model before starting the backend")
    })?;
    let descriptor = descriptor_for(selected_variant)?;
    let working_directory = runtime_dir_for(app_data_dir, settings);
    let checkpoints_directory = checkpoints_dir_for(app_data_dir, settings);

    fs::create_dir_all(&working_directory)
        .map_err(|error| AppError::backend_start_failed(error.to_string()))?;
    fs::create_dir_all(&checkpoints_directory)
        .map_err(|error| AppError::backend_start_failed(error.to_string()))?;
    ensure_runtime_checkpoints_link(&working_directory, &checkpoints_directory).map_err(
        |error| {
            AppError::backend_start_failed(
                error
                    .details
                    .unwrap_or_else(|| "failed to prepare ACE-Step checkpoints link".to_owned()),
            )
        },
    )?;

    Ok(RuntimeLayout {
        descriptor,
        working_directory,
        checkpoints_directory,
    })
}

pub fn descriptor_for(variant: ModelVariant) -> AppResult<&'static AceModelDescriptor> {
    ACE_MODEL_DESCRIPTORS
        .iter()
        .find(|descriptor| descriptor.variant == variant)
        .ok_or_else(|| AppError::model_not_found(format!("unknown model variant {variant:?}")))
}

pub fn runtime_dir_for(app_data_dir: &Path, settings: &AppSettings) -> PathBuf {
    settings
        .backend_working_directory
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or_else(|| app_data_dir.join("runtime").join("ACE-Step-1.5"))
}

pub fn checkpoints_dir_for(app_data_dir: &Path, settings: &AppSettings) -> PathBuf {
    settings
        .model_directory
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or_else(|| app_data_dir.join("models").join("checkpoints"))
}

pub fn ensure_runtime_checkpoints_link(
    runtime_dir: &Path,
    checkpoints_dir: &Path,
) -> AppResult<()> {
    fs::create_dir_all(checkpoints_dir).map_err(|error| {
        AppError::model_not_found(format!(
            "failed to create checkpoints directory {}: {error}",
            checkpoints_dir.display()
        ))
    })?;
    fs::create_dir_all(runtime_dir).map_err(|error| {
        AppError::model_not_found(format!(
            "failed to create runtime directory {}: {error}",
            runtime_dir.display()
        ))
    })?;

    let runtime_checkpoints = runtime_dir.join("checkpoints");
    if runtime_checkpoints.exists() {
        let metadata = fs::symlink_metadata(&runtime_checkpoints).map_err(|error| {
            AppError::model_not_found(format!(
                "failed to inspect runtime checkpoints path {}: {error}",
                runtime_checkpoints.display()
            ))
        })?;
        if metadata.file_type().is_symlink() {
            let target = fs::read_link(&runtime_checkpoints).map_err(|error| {
                AppError::model_not_found(format!(
                    "failed to inspect runtime checkpoints link {}: {error}",
                    runtime_checkpoints.display()
                ))
            })?;
            if target == checkpoints_dir {
                return Ok(());
            }
            fs::remove_file(&runtime_checkpoints).map_err(|error| {
                AppError::model_not_found(format!(
                    "failed to replace runtime checkpoints link {}: {error}",
                    runtime_checkpoints.display()
                ))
            })?;
        } else if metadata.is_dir() {
            let is_empty = fs::read_dir(&runtime_checkpoints)
                .map_err(|error| {
                    AppError::model_not_found(format!(
                        "failed to inspect runtime checkpoints directory {}: {error}",
                        runtime_checkpoints.display()
                    ))
                })?
                .next()
                .is_none();
            if is_empty {
                fs::remove_dir(&runtime_checkpoints).map_err(|error| {
                    AppError::model_not_found(format!(
                        "failed to replace empty runtime checkpoints directory {}: {error}",
                        runtime_checkpoints.display()
                    ))
                })?;
            } else {
                let backup_path = runtime_dir.join(format!(
                    "checkpoints.openloop-backup-{}",
                    Utc::now().format("%Y%m%d-%H%M%S")
                ));
                fs::rename(&runtime_checkpoints, &backup_path).map_err(|error| {
                    AppError::model_not_found(format!(
                        "failed to back up existing runtime checkpoints directory {} to {}: {error}",
                        runtime_checkpoints.display(),
                        backup_path.display()
                    ))
                })?;
            }
        } else {
            return Err(AppError::model_not_found(format!(
                "runtime checkpoints path {} already exists and is not an OpenLoop-managed link",
                runtime_checkpoints.display()
            )));
        }
    }

    #[cfg(unix)]
    {
        unix_fs::symlink(checkpoints_dir, &runtime_checkpoints).map_err(|error| {
            AppError::model_not_found(format!(
                "failed to link runtime checkpoints {} -> {}: {error}",
                runtime_checkpoints.display(),
                checkpoints_dir.display()
            ))
        })?;
        Ok(())
    }

    #[cfg(not(unix))]
    {
        Err(AppError::model_not_found(
            "OpenLoop model linking currently requires macOS or another Unix platform",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(unix)]
    fn checkpoints_link_backs_up_existing_non_empty_directory() {
        let temp = tempfile::tempdir().expect("temp dir");
        let runtime_dir = temp.path().join("runtime");
        let checkpoints_dir = temp.path().join("models");
        let existing = runtime_dir.join("checkpoints");

        fs::create_dir_all(&existing).expect("existing checkpoints");
        fs::write(existing.join("legacy.bin"), b"legacy").expect("legacy file");
        fs::create_dir_all(&checkpoints_dir).expect("model dir");

        ensure_runtime_checkpoints_link(&runtime_dir, &checkpoints_dir).expect("link");

        let target = fs::read_link(runtime_dir.join("checkpoints")).expect("symlink target");
        assert_eq!(target, checkpoints_dir);
        let backup_exists = fs::read_dir(&runtime_dir)
            .expect("runtime entries")
            .flatten()
            .any(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with("checkpoints.openloop-backup-")
            });
        assert!(backup_exists);
    }

    #[test]
    fn prepare_runtime_layout_requires_selected_model() {
        let temp = tempfile::tempdir().expect("temp dir");
        let settings = AppSettings::default();

        let error = prepare_runtime_layout(temp.path(), &settings).expect_err("model required");

        assert_eq!(error.code, "MODEL_NOT_FOUND");
    }
}
