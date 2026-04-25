use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

#[cfg(unix)]
use std::os::unix::fs as unix_fs;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::models::{
    errors::{AppError, AppResult},
    settings::{AppSettings, ModelVariant},
};

pub const ACE_STEP_REPO_URL: &str = "https://github.com/ACE-Step/ACE-Step-1.5.git";
pub const MODEL_DOWNLOAD_EVENT: &str = "model-download-progress";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AceModelDescriptor {
    pub variant: ModelVariant,
    pub label: &'static str,
    pub model_name: &'static str,
    pub lm_model: Option<&'static str>,
    pub lm_backend: &'static str,
    pub estimated_size_bytes: u64,
    pub description: &'static str,
    pub recommended_memory_gb: u64,
}

pub const ACE_MODEL_DESCRIPTORS: &[AceModelDescriptor] = &[
    AceModelDescriptor {
        variant: ModelVariant::Turbo,
        label: "Turbo",
        model_name: "acestep-v15-turbo",
        lm_model: Some("acestep-5Hz-lm-0.6B"),
        lm_backend: "mlx",
        estimated_size_bytes: 8 * 1024 * 1024 * 1024,
        description: "Official ACE-Step 1.5 standard profile for 16 GB Apple Silicon: turbo DiT with 0.6B LM.",
        recommended_memory_gb: 16,
    },
    AceModelDescriptor {
        variant: ModelVariant::Lite,
        label: "Lite",
        model_name: "acestep-v15-turbo",
        lm_model: Some("acestep-5Hz-lm-0.6B"),
        lm_backend: "mlx",
        estimated_size_bytes: 8 * 1024 * 1024 * 1024,
        description: "Lower-memory official profile: turbo DiT with lightweight 0.6B LM.",
        recommended_memory_gb: 8,
    },
    AceModelDescriptor {
        variant: ModelVariant::Pro,
        label: "XL Turbo",
        model_name: "acestep-v15-xl-turbo",
        lm_model: Some("acestep-5Hz-lm-1.7B"),
        lm_backend: "mlx",
        estimated_size_bytes: 22 * 1024 * 1024 * 1024,
        description: "Higher-quality XL turbo profile; best on 20GB+ machines.",
        recommended_memory_gb: 20,
    },
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelDownloadState {
    NotInstalled,
    Downloading,
    Ready,
    Outdated,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatusSnapshot {
    pub variant: ModelVariant,
    pub state: ModelDownloadState,
    pub model_name: String,
    pub label: String,
    pub description: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub installed_revision: Option<String>,
    pub runtime_revision: Option<String>,
    pub error: Option<AppError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelManifest {
    ace_step_repo: String,
    updated_at: String,
    installed: BTreeMap<String, InstalledModelManifest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstalledModelManifest {
    model_name: String,
    lm_model: Option<String>,
    repo_revision: String,
    installed_at: String,
}

impl Default for ModelManifest {
    fn default() -> Self {
        Self {
            ace_step_repo: ACE_STEP_REPO_URL.to_owned(),
            updated_at: Utc::now().to_rfc3339(),
            installed: BTreeMap::new(),
        }
    }
}

#[derive(Debug)]
pub struct ModelManager {
    app_data_dir: PathBuf,
    status: Arc<Mutex<Vec<ModelStatusSnapshot>>>,
}

impl ModelManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let manager = Self {
            app_data_dir,
            status: Arc::new(Mutex::new(Vec::new())),
        };
        let snapshots = manager.inspect_all(&AppSettings::default());
        if let Ok(mut status) = manager.status.lock() {
            *status = snapshots;
        }
        manager
    }

    pub fn status_handle(&self) -> Arc<Mutex<Vec<ModelStatusSnapshot>>> {
        Arc::clone(&self.status)
    }

    pub fn inspect_all(&self, settings: &AppSettings) -> Vec<ModelStatusSnapshot> {
        ACE_MODEL_DESCRIPTORS
            .iter()
            .map(|descriptor| self.inspect_descriptor(settings, descriptor))
            .collect()
    }

    pub fn refresh(&self, settings: &AppSettings) -> Vec<ModelStatusSnapshot> {
        let snapshots = self.inspect_all(settings);
        if let Ok(mut status) = self.status.lock() {
            *status = snapshots.clone();
        }
        snapshots
    }

    pub fn download(
        &self,
        app: AppHandle,
        settings: AppSettings,
        variant: ModelVariant,
    ) -> AppResult<ModelStatusSnapshot> {
        let descriptor = descriptor_for(variant)?;
        let initial = self.downloading_snapshot(&settings, descriptor, 0, None, None);
        self.publish_snapshot(&app, initial.clone());

        let app_data_dir = self.app_data_dir.clone();
        let status = self.status_handle();
        tauri::async_runtime::spawn(async move {
            poll_download_sizes(
                app.clone(),
                app_data_dir.clone(),
                settings.clone(),
                descriptor,
                Arc::clone(&status),
            );
            let blocking_app_data_dir = app_data_dir.clone();
            let blocking_settings = settings.clone();
            let result = tauri::async_runtime::spawn_blocking(move || {
                let runtime_dir = runtime_dir_for(&blocking_app_data_dir, &blocking_settings);
                let checkpoints_dir =
                    checkpoints_dir_for(&blocking_app_data_dir, &blocking_settings);
                fs::create_dir_all(&runtime_dir).map_err(|error| {
                    AppError::model_not_found(format!(
                        "failed to create runtime directory {}: {error}",
                        runtime_dir.display()
                    ))
                })?;
                fs::create_dir_all(&checkpoints_dir).map_err(|error| {
                    AppError::model_not_found(format!(
                        "failed to create checkpoints directory {}: {error}",
                        checkpoints_dir.display()
                    ))
                })?;
                ensure_runtime_repo(&runtime_dir)?;
                ensure_runtime_checkpoints_link(&runtime_dir, &checkpoints_dir)?;
                run_uv_sync(&runtime_dir)?;

                let revision = local_runtime_revision(&runtime_dir).ok();
                run_main_model_download(&runtime_dir, &checkpoints_dir, descriptor)?;
                if descriptor.lm_model == Some("acestep-5Hz-lm-0.6B") {
                    run_model_download(
                        &runtime_dir,
                        &checkpoints_dir,
                        "acestep-5Hz-lm-0.6B",
                        descriptor,
                    )?;
                }
                if descriptor.model_name != "acestep-v15-turbo" {
                    run_model_download(
                        &runtime_dir,
                        &checkpoints_dir,
                        descriptor.model_name,
                        descriptor,
                    )?;
                }

                let mut manifest = read_manifest(&blocking_app_data_dir).unwrap_or_default();
                manifest.updated_at = Utc::now().to_rfc3339();
                manifest.installed.insert(
                    variant_key(descriptor.variant),
                    InstalledModelManifest {
                        model_name: descriptor.model_name.to_owned(),
                        lm_model: descriptor.lm_model.map(str::to_owned),
                        repo_revision: revision.unwrap_or_else(|| "unknown".to_owned()),
                        installed_at: Utc::now().to_rfc3339(),
                    },
                );
                write_manifest(&blocking_app_data_dir, &manifest)?;

                Ok::<_, AppError>(())
            })
            .await;

            let final_snapshot = match result {
                Ok(Ok(())) => inspect_descriptor_for(&app_data_dir, &settings, descriptor),
                Ok(Err(error)) => failed_snapshot_for(&app_data_dir, &settings, descriptor, error),
                Err(error) => failed_snapshot_for(
                    &app_data_dir,
                    &settings,
                    descriptor,
                    AppError::model_not_found(error.to_string()),
                ),
            };

            if let Ok(mut guard) = status.lock() {
                upsert_snapshot(&mut guard, final_snapshot.clone());
            }
            let _ = app.emit(MODEL_DOWNLOAD_EVENT, final_snapshot);
        });

        Ok(initial)
    }

    pub fn delete(
        &self,
        settings: &AppSettings,
        variant: ModelVariant,
    ) -> AppResult<Vec<ModelStatusSnapshot>> {
        let descriptor = descriptor_for(variant)?;
        let checkpoints_dir = checkpoints_dir_for(&self.app_data_dir, settings);
        for model_name in required_model_names(descriptor) {
            let path = checkpoints_dir.join(model_name);
            if path.exists() {
                fs::remove_dir_all(&path).map_err(|error| {
                    AppError::model_not_found(format!(
                        "failed to delete model directory {}: {error}",
                        path.display()
                    ))
                })?;
            }
        }

        let mut manifest = read_manifest(&self.app_data_dir).unwrap_or_default();
        manifest.installed.remove(&variant_key(variant));
        manifest.updated_at = Utc::now().to_rfc3339();
        write_manifest(&self.app_data_dir, &manifest)?;
        Ok(self.refresh(settings))
    }

    fn inspect_descriptor(
        &self,
        settings: &AppSettings,
        descriptor: &AceModelDescriptor,
    ) -> ModelStatusSnapshot {
        inspect_descriptor_for(&self.app_data_dir, settings, descriptor)
    }

    fn downloading_snapshot(
        &self,
        settings: &AppSettings,
        descriptor: &AceModelDescriptor,
        downloaded_bytes: u64,
        total_bytes: Option<u64>,
        error: Option<AppError>,
    ) -> ModelStatusSnapshot {
        let mut snapshot = self.inspect_descriptor(settings, descriptor);
        snapshot.state = ModelDownloadState::Downloading;
        snapshot.downloaded_bytes = downloaded_bytes;
        snapshot.total_bytes = total_bytes.or(Some(descriptor.estimated_size_bytes));
        snapshot.error = error;
        snapshot
    }

    fn publish_snapshot(&self, app: &AppHandle, snapshot: ModelStatusSnapshot) {
        if let Ok(mut guard) = self.status.lock() {
            upsert_snapshot(&mut guard, snapshot.clone());
        }
        let _ = app.emit(MODEL_DOWNLOAD_EVENT, snapshot);
    }
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
        } else if metadata.is_dir()
            && fs::read_dir(&runtime_checkpoints)
                .map_err(|error| {
                    AppError::model_not_found(format!(
                        "failed to inspect runtime checkpoints directory {}: {error}",
                        runtime_checkpoints.display()
                    ))
                })?
                .next()
                .is_none()
        {
            fs::remove_dir(&runtime_checkpoints).map_err(|error| {
                AppError::model_not_found(format!(
                    "failed to replace empty runtime checkpoints directory {}: {error}",
                    runtime_checkpoints.display()
                ))
            })?;
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

fn required_model_names(descriptor: &AceModelDescriptor) -> Vec<&'static str> {
    let mut models = vec![descriptor.model_name];
    if let Some(lm_model) = descriptor.lm_model {
        models.push(lm_model);
    }
    models
}

fn inspect_descriptor_for(
    app_data_dir: &Path,
    settings: &AppSettings,
    descriptor: &AceModelDescriptor,
) -> ModelStatusSnapshot {
    let checkpoints_dir = checkpoints_dir_for(app_data_dir, settings);
    let manifest = read_manifest(app_data_dir).unwrap_or_default();
    let installed = manifest.installed.get(&variant_key(descriptor.variant));
    let runtime_revision = local_runtime_revision(&runtime_dir_for(app_data_dir, settings)).ok();
    let downloaded_bytes = required_model_names(descriptor)
        .iter()
        .map(|name| directory_size(&checkpoints_dir.join(name)))
        .sum();
    let installed_all = required_model_names(descriptor)
        .iter()
        .all(|name| checkpoints_dir.join(name).exists());
    let installed_revision = installed.map(|entry| entry.repo_revision.clone());
    let outdated = installed_all
        && installed_revision.is_some()
        && runtime_revision.is_some()
        && installed_revision != runtime_revision;

    let state = if outdated {
        ModelDownloadState::Outdated
    } else if installed_all {
        ModelDownloadState::Ready
    } else {
        ModelDownloadState::NotInstalled
    };

    ModelStatusSnapshot {
        variant: descriptor.variant,
        state,
        model_name: descriptor.model_name.to_owned(),
        label: descriptor.label.to_owned(),
        description: descriptor.description.to_owned(),
        downloaded_bytes,
        total_bytes: Some(descriptor.estimated_size_bytes),
        installed_revision,
        runtime_revision,
        error: None,
    }
}

fn failed_snapshot_for(
    app_data_dir: &Path,
    settings: &AppSettings,
    descriptor: &AceModelDescriptor,
    error: AppError,
) -> ModelStatusSnapshot {
    let mut snapshot = inspect_descriptor_for(app_data_dir, settings, descriptor);
    snapshot.state = ModelDownloadState::Failed;
    snapshot.error = Some(error);
    snapshot
}

fn ensure_runtime_repo(runtime_dir: &Path) -> AppResult<()> {
    if runtime_dir.join(".git").exists() {
        run_command(
            Command::new("git")
                .arg("-C")
                .arg(runtime_dir)
                .arg("fetch")
                .arg("--depth")
                .arg("1")
                .arg("origin")
                .arg("main"),
            "failed to fetch ACE-Step runtime updates",
        )?;
        run_command(
            Command::new("git")
                .arg("-C")
                .arg(runtime_dir)
                .arg("reset")
                .arg("--hard")
                .arg("FETCH_HEAD"),
            "failed to update ACE-Step runtime checkout",
        )?;
        return Ok(());
    }

    if runtime_dir.exists() {
        fs::remove_dir_all(runtime_dir).map_err(|error| {
            AppError::model_not_found(format!(
                "failed to replace invalid runtime directory {}: {error}",
                runtime_dir.display()
            ))
        })?;
    }

    let parent = runtime_dir.parent().ok_or_else(|| {
        AppError::model_not_found(format!(
            "runtime path {} has no parent directory",
            runtime_dir.display()
        ))
    })?;
    fs::create_dir_all(parent).map_err(|error| {
        AppError::model_not_found(format!(
            "failed to create runtime directory {}: {error}",
            parent.display()
        ))
    })?;
    run_command(
        Command::new("git")
            .arg("clone")
            .arg("--depth")
            .arg("1")
            .arg(ACE_STEP_REPO_URL)
            .arg(runtime_dir),
        "failed to clone ACE-Step runtime",
    )
}

fn run_uv_sync(runtime_dir: &Path) -> AppResult<()> {
    run_command(
        Command::new("uv").arg("sync").current_dir(runtime_dir),
        "failed to install ACE-Step Python environment with uv",
    )
}

fn run_model_download(
    runtime_dir: &Path,
    checkpoints_dir: &Path,
    model_name: &str,
    descriptor: &AceModelDescriptor,
) -> AppResult<()> {
    let mut command = Command::new("uv");
    command
        .arg("run")
        .arg("acestep-download")
        .arg("--model")
        .arg(model_name)
        .arg("--skip-main")
        .arg("--dir")
        .arg(checkpoints_dir)
        .current_dir(runtime_dir)
        .env("ACESTEP_CHECKPOINTS_DIR", checkpoints_dir)
        .env("ACESTEP_PROJECT_ROOT", runtime_dir)
        .env("ACESTEP_CONFIG_PATH", descriptor.model_name)
        .env("ACESTEP_LM_BACKEND", descriptor.lm_backend)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());
    run_command(
        &mut command,
        &format!("failed to download ACE-Step model {model_name}"),
    )
}

fn run_main_model_download(
    runtime_dir: &Path,
    checkpoints_dir: &Path,
    descriptor: &AceModelDescriptor,
) -> AppResult<()> {
    let mut command = Command::new("uv");
    command
        .arg("run")
        .arg("acestep-download")
        .arg("--dir")
        .arg(checkpoints_dir)
        .current_dir(runtime_dir)
        .env("ACESTEP_CHECKPOINTS_DIR", checkpoints_dir)
        .env("ACESTEP_PROJECT_ROOT", runtime_dir)
        .env("ACESTEP_CONFIG_PATH", descriptor.model_name)
        .env("ACESTEP_LM_BACKEND", descriptor.lm_backend)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());
    run_command(&mut command, "failed to download ACE-Step main model")
}

fn run_command(command: &mut Command, context: &str) -> AppResult<()> {
    let output = command.output().map_err(|error| {
        AppError::model_not_found(format!("{context}: failed to spawn command: {error}"))
    })?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    Err(AppError::model_not_found(format!(
        "{context}: status {}; stdout: {}; stderr: {}",
        output.status, stdout, stderr
    )))
}

fn manifest_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir
        .join("models")
        .join("openloop-ace-manifest.json")
}

fn read_manifest(app_data_dir: &Path) -> AppResult<ModelManifest> {
    let path = manifest_path(app_data_dir);
    if !path.exists() {
        return Ok(ModelManifest::default());
    }
    let payload = fs::read_to_string(&path).map_err(|error| {
        AppError::model_not_found(format!(
            "failed to read model manifest {}: {error}",
            path.display()
        ))
    })?;
    serde_json::from_str(&payload).map_err(|error| {
        AppError::model_not_found(format!(
            "failed to parse model manifest {}: {error}",
            path.display()
        ))
    })
}

fn write_manifest(app_data_dir: &Path, manifest: &ModelManifest) -> AppResult<()> {
    let path = manifest_path(app_data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            AppError::model_not_found(format!(
                "failed to create model manifest directory {}: {error}",
                parent.display()
            ))
        })?;
    }
    let payload = serde_json::to_string_pretty(manifest)
        .map_err(|error| AppError::model_not_found(error.to_string()))?;
    fs::write(&path, payload).map_err(|error| {
        AppError::model_not_found(format!(
            "failed to write model manifest {}: {error}",
            path.display()
        ))
    })
}

fn local_runtime_revision(runtime_dir: &Path) -> AppResult<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(runtime_dir)
        .arg("rev-parse")
        .arg("HEAD")
        .output()
        .map_err(|error| AppError::model_not_found(error.to_string()))?;
    if !output.status.success() {
        return Err(AppError::model_not_found(
            "ACE-Step runtime git revision is unavailable",
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn directory_size(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }
    if path.is_file() {
        return fs::metadata(path)
            .map(|metadata| metadata.len())
            .unwrap_or(0);
    }
    let mut total = 0;
    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };
    for entry in entries.flatten() {
        total += directory_size(&entry.path());
    }
    total
}

fn variant_key(variant: ModelVariant) -> String {
    match variant {
        ModelVariant::Lite => "lite",
        ModelVariant::Turbo => "turbo",
        ModelVariant::Pro => "pro",
    }
    .to_owned()
}

fn upsert_snapshot(snapshots: &mut Vec<ModelStatusSnapshot>, snapshot: ModelStatusSnapshot) {
    if let Some(existing) = snapshots
        .iter_mut()
        .find(|current| current.variant == snapshot.variant)
    {
        *existing = snapshot;
    } else {
        snapshots.push(snapshot);
    }
}

pub fn poll_download_sizes(
    app: AppHandle,
    app_data_dir: PathBuf,
    settings: AppSettings,
    descriptor: &'static AceModelDescriptor,
    status: Arc<Mutex<Vec<ModelStatusSnapshot>>>,
) {
    thread::spawn(move || loop {
        let snapshot = inspect_descriptor_for(&app_data_dir, &settings, descriptor);
        if !matches!(snapshot.state, ModelDownloadState::NotInstalled) {
            break;
        }
        let mut downloading = snapshot;
        downloading.state = ModelDownloadState::Downloading;
        if let Ok(mut guard) = status.lock() {
            upsert_snapshot(&mut guard, downloading.clone());
        }
        let _ = app.emit(MODEL_DOWNLOAD_EVENT, downloading);
        thread::sleep(Duration::from_millis(1000));
    });
}
