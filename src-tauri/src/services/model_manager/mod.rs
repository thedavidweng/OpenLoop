pub mod specs;
pub mod types;

pub use specs::*;
pub use types::*;

use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

use chrono::Utc;
use futures_util::StreamExt;
use reqwest::redirect::Policy;
use reqwest::Client;
use sha2::Digest;
use tauri::{AppHandle, Emitter};

use crate::models::{
    errors::{AppError, AppResult},
    settings::{AppSettings, ModelVariant},
};
use crate::services::model_bootstrap::{checkpoints_dir_for, descriptor_for};
use crate::services::network_log::NetworkActivityLog;

pub const ACE_MODEL_DESCRIPTORS: &[AceModelDescriptor] = &[
    AceModelDescriptor {
        variant: ModelVariant::Turbo,
        label: "Standard",
        model_name: "acestep-v15-turbo",
        lm_model: Some("acestep-5Hz-lm-0.6B"),
        lm_backend: "mlx",
        estimated_size_bytes: STANDARD_PACK_TOTAL_BYTES,
        description: "Recommended for 16 GB Apple Silicon. Turbo DiT paired with the 0.6B language model.",
        recommended_memory_gb: 16,
    },
    AceModelDescriptor {
        variant: ModelVariant::Lite,
        label: "Lite",
        model_name: "acestep-v15-turbo",
        lm_model: Some("acestep-5Hz-lm-0.6B"),
        lm_backend: "mlx",
        estimated_size_bytes: STANDARD_PACK_TOTAL_BYTES,
        description: "Lightweight setup for 8 GB systems. Same weights as Standard, tuned for lower memory.",
        recommended_memory_gb: 8,
    },
    AceModelDescriptor {
        variant: ModelVariant::Pro,
        label: "XL Turbo",
        model_name: "acestep-v15-xl-turbo",
        lm_model: Some("acestep-5Hz-lm-1.7B"),
        lm_backend: "mlx",
        estimated_size_bytes: XL_PACK_TOTAL_BYTES,
        description: "Highest fidelity. Requires roughly 24 GB of free disk and a 24 GB+ Apple Silicon machine.",
        recommended_memory_gb: 24,
    },
];

#[derive(Debug)]
pub struct ModelManager {
    app_data_dir: PathBuf,
    status: Arc<Mutex<Vec<ModelStatusSnapshot>>>,
    #[allow(clippy::type_complexity)]
    in_flight: Arc<Mutex<Vec<(ModelVariant, Arc<AtomicBool>)>>>,
    network_log: Arc<NetworkActivityLog>,
}

impl ModelManager {
    pub fn new(app_data_dir: PathBuf, network_log: Arc<NetworkActivityLog>) -> Self {
        let manager = Self {
            app_data_dir,
            network_log,
            status: Arc::new(Mutex::new(Vec::new())),
            in_flight: Arc::new(Mutex::new(Vec::new())),
        };
        resume_pending_deletions(&manager.app_data_dir, &AppSettings::default());
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
            .map(|descriptor| inspect_descriptor_for(&self.app_data_dir, settings, descriptor))
            .collect()
    }

    pub fn refresh(&self, settings: &AppSettings) -> Vec<ModelStatusSnapshot> {
        let mut snapshots = self.inspect_all(settings);
        if let Ok(status) = self.status.lock() {
            for current in status.iter() {
                if matches!(current.state, ModelDownloadState::Downloading) {
                    upsert_snapshot(&mut snapshots, current.clone());
                }
            }
        }
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

        if let Ok(mut guard) = self.in_flight.lock() {
            if let Some((_, cancel)) = guard.iter().find(|(v, _)| *v == variant) {
                cancel.store(true, Ordering::SeqCst);
                guard.retain(|(v, _)| *v != variant);
            }
            let cancel = Arc::new(AtomicBool::new(false));
            guard.push((variant, Arc::clone(&cancel)));
        }

        let pack = pack_for_descriptor(descriptor);
        let total_bytes = pack.iter().map(|file| file.size).sum::<u64>();
        let initial = downloading_snapshot(
            &self.app_data_dir,
            &settings,
            descriptor,
            0,
            Some(total_bytes),
        );
        publish_snapshot(&app, &self.status, initial.clone());

        let app_data_dir = self.app_data_dir.clone();
        let status = Arc::clone(&self.status);
        let in_flight = Arc::clone(&self.in_flight);
        let download_settings = settings.clone();
        let network_log = Arc::clone(&self.network_log);

        if let Ok(guard) = self.in_flight.lock() {
            if let Some((_, cancel)) = guard.iter().find(|(v, _)| *v == variant) {
                let cancel = Arc::clone(cancel);
                let pack_for_cleanup = pack.clone();

                tauri::async_runtime::spawn(async move {
                    let result = download_pack(
                        &app,
                        &app_data_dir,
                        &download_settings,
                        descriptor,
                        pack,
                        total_bytes,
                        &status,
                        &cancel,
                        &network_log,
                    )
                    .await;

                    if cancel.load(Ordering::SeqCst) {
                        let checkpoints_dir =
                            checkpoints_dir_for(&app_data_dir, &download_settings);
                        for spec in &pack_for_cleanup {
                            let part = part_path(&checkpoints_dir.join(spec.local_path));
                            if part.exists() {
                                let _ = fs::remove_file(&part);
                            }
                        }
                        let cancelled = ModelStatusSnapshot {
                            variant: descriptor.variant,
                            state: ModelDownloadState::Failed,
                            model_name: descriptor.model_name.to_owned(),
                            label: descriptor.label.to_owned(),
                            description: descriptor.description.to_owned(),
                            downloaded_bytes: 0,
                            total_bytes: Some(total_bytes),
                            installed_at: None,
                            error: Some(AppError::model_download_failed("Download cancelled.")),
                        };
                        publish_snapshot(&app, &status, cancelled);
                    } else {
                        let final_snapshot = match result {
                            Ok(()) => {
                                if let Err(error) = record_install(&app_data_dir, descriptor) {
                                    tracing::error!(
                                        "failed to persist model install manifest: {}",
                                        error.message
                                    );
                                }
                                inspect_descriptor_for(
                                    &app_data_dir,
                                    &download_settings,
                                    descriptor,
                                )
                            }
                            Err(error) => {
                                tracing::error!(
                                    "model download for {:?} failed: {}",
                                    variant,
                                    error.message
                                );
                                failed_snapshot_for(
                                    &app_data_dir,
                                    &download_settings,
                                    descriptor,
                                    error,
                                )
                            }
                        };
                        publish_snapshot(&app, &status, final_snapshot);
                    }

                    if let Ok(mut guard) = in_flight.lock() {
                        guard.retain(|(v, _)| *v != variant);
                    }
                });
            }
        }

        Ok(initial)
    }

    pub fn download_blocking(
        &self,
        settings: &AppSettings,
        variant: ModelVariant,
    ) -> AppResult<ModelStatusSnapshot> {
        let descriptor = descriptor_for(variant)?;
        let pack = pack_for_descriptor(descriptor);
        let checkpoints_dir = checkpoints_dir_for(&self.app_data_dir, settings);

        fs::create_dir_all(&checkpoints_dir).map_err(|error| {
            AppError::model_download_failed(format!(
                "failed to create checkpoints directory {}: {error}",
                checkpoints_dir.display()
            ))
        })?;

        let client = blocking_http_client()?;

        let mirror = settings.model_mirror.as_deref().unwrap_or(HF_RESOLVE_BASE);
        for spec in &pack {
            let target = checkpoints_dir.join(spec.local_path);
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    AppError::model_download_failed(format!(
                        "failed to create directory {}: {error}",
                        parent.display()
                    ))
                })?;
            }

            if let Ok(metadata) = fs::metadata(&target) {
                if metadata.is_file() && metadata.len() >= spec.size {
                    continue;
                }
            }

            download_single_file_blocking(&client, spec, &target, mirror, &self.network_log)?;
        }

        record_install(&self.app_data_dir, descriptor)?;
        Ok(inspect_descriptor_for(
            &self.app_data_dir,
            settings,
            descriptor,
        ))
    }

    pub fn delete(
        &self,
        app: AppHandle,
        settings: AppSettings,
        variant: ModelVariant,
    ) -> AppResult<ModelStatusSnapshot> {
        let descriptor = descriptor_for(variant)?;
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
        publish_snapshot(&app, &self.status, initial.clone());

        write_delete_marker(&self.app_data_dir, variant);

        let app_data_dir = self.app_data_dir.clone();
        let settings_for_blocking = settings.clone();
        let settings_for_final = settings.clone();
        let app_data_dir_for_final = self.app_data_dir.clone();
        let status = Arc::clone(&self.status);
        let variant_key = variant_key(descriptor.variant);

        tauri::async_runtime::spawn(async move {
            let result = tokio::task::spawn_blocking(move || {
                let checkpoints_dir = checkpoints_dir_for(&app_data_dir, &settings_for_blocking);
                for spec in pack_for_descriptor(descriptor) {
                    let target = checkpoints_dir.join(spec.local_path);
                    if target.exists() {
                        fs::remove_file(&target).ok();
                    }
                    let part = part_path(&target);
                    if part.exists() {
                        let _ = fs::remove_file(&part);
                    }
                }

                for model_dir_name in unique_model_dirs(pack_for_descriptor(descriptor)) {
                    let dir = checkpoints_dir.join(model_dir_name);
                    let _ = fs::read_dir(&dir).map(|mut iter| {
                        if iter.next().is_none() {
                            let _ = fs::remove_dir(&dir);
                        }
                    });
                }

                let mut manifest = read_manifest(&app_data_dir).unwrap_or_default();
                manifest.installed.remove(&variant_key);
                manifest.updated_at = Utc::now().to_rfc3339();
                write_manifest(&app_data_dir, &manifest).ok();
            })
            .await;

            clear_delete_marker(&app_data_dir_for_final, variant);

            if let Err(error) = result {
                tracing::error!("model delete for {:?} panicked: {error}", variant);
            }

            let final_snapshot =
                inspect_descriptor_for(&app_data_dir_for_final, &settings_for_final, descriptor);
            publish_snapshot(&app, &status, final_snapshot);
        });

        Ok(initial)
    }

    pub fn clear_partial_downloads(
        &self,
        settings: &AppSettings,
        variant: ModelVariant,
    ) -> AppResult<ModelStatusSnapshot> {
        let descriptor = descriptor_for(variant)?;
        let checkpoints_dir = checkpoints_dir_for(&self.app_data_dir, settings);
        for spec in pack_for_descriptor(descriptor) {
            let target = checkpoints_dir.join(spec.local_path);
            let part = part_path(&target);
            if part.exists() {
                let _ = fs::remove_file(&part);
            }
        }
        Ok(inspect_descriptor_for(
            &self.app_data_dir,
            settings,
            descriptor,
        ))
    }

    pub fn delete_all(&self, settings: &AppSettings) -> Vec<ModelStatusSnapshot> {
        let manifest = read_manifest(&self.app_data_dir).unwrap_or_default();
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
            write_delete_marker(&self.app_data_dir, *variant);
        }

        for variant in &variants_to_delete {
            let descriptor = match descriptor_for(*variant) {
                Ok(d) => d,
                Err(_) => continue,
            };
            let checkpoints_dir = checkpoints_dir_for(&self.app_data_dir, settings);
            for spec in pack_for_descriptor(descriptor) {
                let target = checkpoints_dir.join(spec.local_path);
                if target.exists() {
                    let _ = fs::remove_file(&target);
                }
                let part = part_path(&target);
                if part.exists() {
                    let _ = fs::remove_file(&part);
                }
            }
            for model_dir_name in unique_model_dirs(pack_for_descriptor(descriptor)) {
                let dir = checkpoints_dir.join(model_dir_name);
                let _ = fs::read_dir(&dir).map(|mut iter| {
                    if iter.next().is_none() {
                        let _ = fs::remove_dir(&dir);
                    }
                });
            }
            clear_delete_marker(&self.app_data_dir, *variant);
        }

        let mut manifest = read_manifest(&self.app_data_dir).unwrap_or_default();
        manifest.installed.clear();
        manifest.updated_at = Utc::now().to_rfc3339();
        let _ = write_manifest(&self.app_data_dir, &manifest);

        self.inspect_all(settings)
    }

    pub fn cancel_download(&self, variant: ModelVariant) -> AppResult<()> {
        if let Ok(guard) = self.in_flight.lock() {
            if let Some((_, cancel)) = guard.iter().find(|(v, _)| *v == variant) {
                cancel.store(true, Ordering::SeqCst);
            }
        }
        Ok(())
    }
}

fn inspect_descriptor_for(
    app_data_dir: &Path,
    settings: &AppSettings,
    descriptor: &AceModelDescriptor,
) -> ModelStatusSnapshot {
    let checkpoints_dir = checkpoints_dir_for(app_data_dir, settings);
    let pack = pack_for_descriptor(descriptor);
    let total_bytes: u64 = pack.iter().map(|spec| spec.size).sum();

    let mut downloaded: u64 = 0;
    let mut all_present = true;
    for spec in &pack {
        if is_runtime_synced_model_code(spec) {
            let target = checkpoints_dir.join(spec.local_path);
            if fs::metadata(&target)
                .map(|metadata| metadata.is_file() && metadata.len() > 0)
                .unwrap_or(false)
            {
                downloaded += spec.size;
            }
            continue;
        }

        let target = checkpoints_dir.join(spec.local_path);
        match fs::metadata(&target) {
            Ok(metadata) if metadata.is_file() => {
                let size = metadata.len();
                if size >= spec.size {
                    downloaded += spec.size;
                } else {
                    downloaded += size;
                    all_present = false;
                }
            }
            _ => {
                all_present = false;
                let part = part_path(&target);
                if let Ok(metadata) = fs::metadata(&part) {
                    downloaded += metadata.len().min(spec.size);
                }
            }
        }
    }

    let manifest = read_manifest(app_data_dir).unwrap_or_default();
    let installed = installed_manifest_for_pack(&manifest, descriptor);
    let state = if all_present {
        ModelDownloadState::Ready
    } else if installed.is_some() {
        ModelDownloadState::Failed
    } else {
        ModelDownloadState::NotInstalled
    };
    let error = if matches!(&state, ModelDownloadState::Failed) {
        Some(AppError::model_download_failed(format!(
            "{} model files are incomplete. Download the model again.",
            descriptor.label
        )))
    } else {
        None
    };
    let downloaded_bytes = if all_present {
        total_bytes
    } else {
        downloaded.min(total_bytes)
    };

    ModelStatusSnapshot {
        variant: descriptor.variant,
        state,
        model_name: descriptor.model_name.to_owned(),
        label: descriptor.label.to_owned(),
        description: descriptor.description.to_owned(),
        downloaded_bytes,
        total_bytes: Some(total_bytes),
        installed_at: installed.map(|entry| entry.installed_at.clone()),
        error,
    }
}

fn is_runtime_synced_model_code(spec: &ModelFileSpec) -> bool {
    spec.local_path.ends_with(".py")
}

fn installed_manifest_for_pack<'a>(
    manifest: &'a ModelManifest,
    descriptor: &AceModelDescriptor,
) -> Option<&'a InstalledModelManifest> {
    manifest
        .installed
        .get(&variant_key(descriptor.variant))
        .or_else(|| {
            ACE_MODEL_DESCRIPTORS
                .iter()
                .find(|candidate| {
                    candidate.model_name == descriptor.model_name
                        && candidate.lm_model == descriptor.lm_model
                        && manifest
                            .installed
                            .contains_key(&variant_key(candidate.variant))
                })
                .and_then(|candidate| manifest.installed.get(&variant_key(candidate.variant)))
        })
}

fn downloading_snapshot(
    app_data_dir: &Path,
    settings: &AppSettings,
    descriptor: &AceModelDescriptor,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
) -> ModelStatusSnapshot {
    let mut snapshot = inspect_descriptor_for(app_data_dir, settings, descriptor);
    snapshot.state = ModelDownloadState::Downloading;
    snapshot.downloaded_bytes = downloaded_bytes;
    if let Some(total) = total_bytes {
        snapshot.total_bytes = Some(total);
    }
    snapshot.error = None;
    snapshot
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

fn publish_snapshot(
    app: &AppHandle,
    status: &Arc<Mutex<Vec<ModelStatusSnapshot>>>,
    snapshot: ModelStatusSnapshot,
) {
    if let Ok(mut guard) = status.lock() {
        upsert_snapshot(&mut guard, snapshot.clone());
    }
    let _ = app.emit(MODEL_DOWNLOAD_EVENT, snapshot);
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

fn http_client() -> AppResult<Client> {
    Client::builder()
        .user_agent(concat!("OpenLoop/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(30))
        .read_timeout(Duration::from_secs(120))
        .pool_idle_timeout(Some(Duration::from_secs(90)))
        .redirect(Policy::limited(20))
        .tcp_keepalive(Some(Duration::from_secs(60)))
        .build()
        .map_err(|error| {
            AppError::model_download_failed(format!("failed to build HTTP client: {error}"))
        })
}

fn blocking_http_client() -> AppResult<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .user_agent(concat!("OpenLoop/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|error| {
            AppError::model_download_failed(format!(
                "failed to build blocking HTTP client: {error}"
            ))
        })
}

fn part_path(target: &Path) -> PathBuf {
    let mut name = target
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_default();
    name.push(PART_SUFFIX);
    target.with_file_name(name)
}

fn record_install(app_data_dir: &Path, descriptor: &AceModelDescriptor) -> AppResult<()> {
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

#[allow(clippy::too_many_arguments)]
async fn download_pack(
    app: &AppHandle,
    app_data_dir: &Path,
    settings: &AppSettings,
    descriptor: &AceModelDescriptor,
    files: Vec<ModelFileSpec>,
    total_bytes: u64,
    status: &Arc<Mutex<Vec<ModelStatusSnapshot>>>,
    cancel: &Arc<AtomicBool>,
    network_log: &NetworkActivityLog,
) -> AppResult<()> {
    let checkpoints_dir = checkpoints_dir_for(app_data_dir, settings);
    fs::create_dir_all(&checkpoints_dir).map_err(|error| {
        AppError::model_download_failed(format!(
            "failed to create checkpoints directory {}: {error}",
            checkpoints_dir.display()
        ))
    })?;

    let client = http_client()?;
    let baseline = Arc::new(AtomicU64::new(0));
    let last_emit = Arc::new(Mutex::new(Instant::now() - PROGRESS_EVENT_INTERVAL * 2));

    let emit_progress = |downloaded_now: u64, force: bool| {
        let total = baseline.load(Ordering::Relaxed) + downloaded_now;
        let total = total.min(total_bytes);
        let should_emit = if force {
            true
        } else if let Ok(mut guard) = last_emit.lock() {
            if guard.elapsed() >= PROGRESS_EVENT_INTERVAL {
                *guard = Instant::now();
                true
            } else {
                false
            }
        } else {
            false
        };
        if should_emit {
            let snapshot =
                downloading_snapshot(app_data_dir, settings, descriptor, total, Some(total_bytes));
            publish_snapshot(app, status, snapshot);
        }
    };

    emit_progress(0, true);

    for spec in &files {
        if cancel.load(Ordering::SeqCst) {
            return Err(AppError::model_download_failed("Download cancelled."));
        }

        let target = checkpoints_dir.join(spec.local_path);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                AppError::model_download_failed(format!(
                    "failed to create directory {}: {error}",
                    parent.display()
                ))
            })?;
        }

        if let Ok(metadata) = fs::metadata(&target) {
            if metadata.is_file() && metadata.len() >= spec.size {
                baseline.fetch_add(spec.size, Ordering::Relaxed);
                emit_progress(0, true);
                continue;
            }
        }

        let mirror = settings.model_mirror.as_deref().unwrap_or(HF_RESOLVE_BASE);
        download_single_file(
            &client,
            spec,
            &target,
            mirror,
            network_log,
            |bytes_in_file| emit_progress(bytes_in_file, false),
        )
        .await?;

        baseline.fetch_add(spec.size, Ordering::Relaxed);
        emit_progress(0, true);
    }

    Ok(())
}

async fn download_single_file<F>(
    client: &Client,
    spec: &ModelFileSpec,
    target: &Path,
    mirror: &str,
    network_log: &NetworkActivityLog,
    mut on_progress: F,
) -> AppResult<()>
where
    F: FnMut(u64),
{
    let url = resolve_download_url(spec, mirror);

    let part = part_path(target);
    let existing_size = fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
    let resume_from = if existing_size > 0 && existing_size < spec.size {
        existing_size
    } else {
        0
    };
    if resume_from == 0 && part.exists() {
        let _ = fs::remove_file(&part);
    }

    const MAX_ATTEMPTS: u32 = 4;
    let mut attempt: u32 = 0;
    let mut last_error: Option<AppError> = None;
    let mut written = resume_from;

    loop {
        attempt += 1;
        on_progress(written);

        let mut request = client.get(&url);
        if written > 0 {
            request = request.header("Range", format!("bytes={written}-"));
        }

        let response = match request.send().await {
            Ok(response) => {
                network_log.record(&url, "GET", response.status().as_u16());
                response
            }
            Err(error) => {
                let message = format!(
                    "failed to request {repo}/{path}: {error}",
                    repo = spec.repo,
                    path = spec.remote_path
                );
                if attempt >= MAX_ATTEMPTS {
                    return Err(AppError::model_download_failed(message));
                }
                tracing::warn!("{} (retry {attempt}/{MAX_ATTEMPTS})", message);
                last_error = Some(AppError::model_download_failed(message));
                tokio::time::sleep(retry_delay(attempt)).await;
                written = fs::metadata(&part).map(|m| m.len()).unwrap_or(written);
                continue;
            }
        };

        if !response.status().is_success() {
            let status_code = response.status();
            let message = format!(
                "Hugging Face returned HTTP {status_code} for {}/{}",
                spec.repo, spec.remote_path
            );
            if status_code.is_server_error() && attempt < MAX_ATTEMPTS {
                tracing::warn!("{} (retry {attempt}/{MAX_ATTEMPTS})", message);
                last_error = Some(AppError::model_download_failed(message));
                tokio::time::sleep(retry_delay(attempt)).await;
                continue;
            }
            return Err(AppError::model_download_failed(message));
        }

        let mut writer = OpenOptions::new()
            .create(true)
            .append(written > 0)
            .write(true)
            .truncate(written == 0)
            .open(&part)
            .map_err(|error| {
                AppError::model_download_failed(format!(
                    "failed to open temporary file {}: {error}",
                    part.display()
                ))
            })?;

        let mut stream = response.bytes_stream();
        let mut stream_failed: Option<AppError> = None;

        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(bytes) => {
                    if bytes.is_empty() {
                        continue;
                    }
                    if let Err(error) = writer.write_all(&bytes) {
                        return Err(AppError::model_download_failed(format!(
                            "failed to write to {}: {error}",
                            part.display()
                        )));
                    }
                    written += bytes.len() as u64;
                    on_progress(written);
                }
                Err(error) => {
                    stream_failed = Some(AppError::model_download_failed(format!(
                        "stream error for {}/{}: {error}",
                        spec.repo, spec.remote_path
                    )));
                    break;
                }
            }
        }

        writer.flush().ok();
        drop(writer);

        if let Some(error) = stream_failed {
            if attempt >= MAX_ATTEMPTS {
                return Err(error);
            }
            tracing::warn!("{} (retry {attempt}/{MAX_ATTEMPTS})", error.message);
            last_error = Some(error);
            tokio::time::sleep(retry_delay(attempt)).await;
            written = fs::metadata(&part).map(|m| m.len()).unwrap_or(written);
            continue;
        }

        if written < spec.size {
            let message = format!(
                "incomplete download for {}/{} ({} / {} bytes)",
                spec.repo, spec.remote_path, written, spec.size
            );
            if attempt >= MAX_ATTEMPTS {
                return Err(AppError::model_download_failed(message));
            }
            tracing::warn!("{} (retry {attempt}/{MAX_ATTEMPTS})", message);
            last_error = Some(AppError::model_download_failed(message));
            tokio::time::sleep(retry_delay(attempt)).await;
            continue;
        }

        break;
    }

    let _ = last_error;
    fs::rename(&part, target).map_err(|error| {
        AppError::model_download_failed(format!(
            "failed to move temporary download {} to {}: {error}",
            part.display(),
            target.display()
        ))
    })?;

    if let Some(expected_sha256) = spec.sha256 {
        if let Err(error) = verify_sha256(target, expected_sha256) {
            let _ = fs::remove_file(target);
            let _ = fs::remove_file(&part);
            return Err(error);
        }
    }

    on_progress(spec.size);
    Ok(())
}

fn download_single_file_blocking(
    client: &reqwest::blocking::Client,
    spec: &ModelFileSpec,
    target: &Path,
    mirror: &str,
    network_log: &NetworkActivityLog,
) -> AppResult<()> {
    use std::io::Read;

    let url = resolve_download_url(spec, mirror);

    let part = part_path(target);
    let existing_size = fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
    let resume_from = if existing_size > 0 && existing_size < spec.size {
        existing_size
    } else {
        0
    };
    if resume_from == 0 && part.exists() {
        let _ = fs::remove_file(&part);
    }

    const MAX_ATTEMPTS: u32 = 4;
    let mut attempt: u32 = 0;
    let mut written = resume_from;

    loop {
        attempt += 1;

        let mut request = client.get(&url);
        if written > 0 {
            request = request.header("Range", format!("bytes={written}-"));
        }

        let mut response = match request.send() {
            Ok(response) => {
                network_log.record(&url, "GET", response.status().as_u16());
                response
            }
            Err(error) => {
                let message = format!(
                    "failed to request {repo}/{path}: {error}",
                    repo = spec.repo,
                    path = spec.remote_path
                );
                if attempt >= MAX_ATTEMPTS {
                    return Err(AppError::model_download_failed(message));
                }
                tracing::warn!("{} (retry {attempt}/{MAX_ATTEMPTS})", message);
                std::thread::sleep(retry_delay(attempt));
                written = fs::metadata(&part).map(|m| m.len()).unwrap_or(written);
                continue;
            }
        };

        if !response.status().is_success() {
            let status_code = response.status();
            let message = format!(
                "Hugging Face returned HTTP {status_code} for {}/{}",
                spec.repo, spec.remote_path
            );
            if status_code.is_server_error() && attempt < MAX_ATTEMPTS {
                tracing::warn!("{} (retry {attempt}/{MAX_ATTEMPTS})", message);
                std::thread::sleep(retry_delay(attempt));
                continue;
            }
            return Err(AppError::model_download_failed(message));
        }

        let mut writer = OpenOptions::new()
            .create(true)
            .append(written > 0)
            .write(true)
            .truncate(written == 0)
            .open(&part)
            .map_err(|error| {
                AppError::model_download_failed(format!(
                    "failed to open temporary file {}: {error}",
                    part.display()
                ))
            })?;

        let mut buffer = [0u8; 8192];
        let reader = &mut response;
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                    writer.write_all(&buffer[..n]).map_err(|error| {
                        AppError::model_download_failed(format!(
                            "failed to write to {}: {error}",
                            part.display()
                        ))
                    })?;
                    written += n as u64;
                }
                Err(error) => {
                    if attempt >= MAX_ATTEMPTS {
                        return Err(AppError::model_download_failed(format!(
                            "stream error for {}/{}: {error}",
                            spec.repo, spec.remote_path
                        )));
                    }
                    tracing::warn!(
                        "stream error for {}/{}: {error} (retry {attempt}/{MAX_ATTEMPTS})",
                        spec.repo,
                        spec.remote_path
                    );
                    std::thread::sleep(retry_delay(attempt));
                    written = fs::metadata(&part).map(|m| m.len()).unwrap_or(written);
                    break;
                }
            }
        }
        writer.flush().ok();
        drop(writer);

        if written < spec.size {
            let message = format!(
                "incomplete download for {}/{} ({} / {} bytes)",
                spec.repo, spec.remote_path, written, spec.size
            );
            if attempt >= MAX_ATTEMPTS {
                return Err(AppError::model_download_failed(message));
            }
            tracing::warn!("{} (retry {attempt}/{MAX_ATTEMPTS})", message);
            std::thread::sleep(retry_delay(attempt));
            continue;
        }

        break;
    }

    fs::rename(&part, target).map_err(|error| {
        AppError::model_download_failed(format!(
            "failed to move temporary download {} to {}: {error}",
            part.display(),
            target.display()
        ))
    })?;

    if let Some(expected_sha256) = spec.sha256 {
        if let Err(error) = verify_sha256(target, expected_sha256) {
            let _ = fs::remove_file(target);
            let _ = fs::remove_file(&part);
            return Err(error);
        }
    }

    Ok(())
}

fn verify_sha256(path: &Path, expected: &str) -> AppResult<()> {
    let mut file = fs::File::open(path).map_err(|error| {
        AppError::model_download_failed(format!(
            "failed to open file for SHA256 verification {}: {error}",
            path.display()
        ))
    })?;
    let mut hasher = sha2::Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        match file.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => hasher.update(&buffer[..n]),
            Err(error) => {
                return Err(AppError::model_download_failed(format!(
                    "failed to read file for SHA256 verification {}: {error}",
                    path.display()
                )));
            }
        }
    }
    let actual = hex_lower(hasher.finalize());
    if actual != expected {
        return Err(AppError::model_download_failed(format!(
            "SHA256 mismatch for {}: expected {expected}, got {actual}",
            path.display()
        )));
    }
    Ok(())
}

fn hex_lower(bytes: impl AsRef<[u8]>) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";

    let bytes = bytes.as_ref();
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

fn resolve_download_url(spec: &ModelFileSpec, mirror: &str) -> String {
    let base = if mirror.is_empty() {
        HF_RESOLVE_BASE
    } else {
        mirror
    };
    if base.contains("modelscope") {
        format!("{base}/{}/resolve/master/{}", spec.repo, spec.remote_path)
    } else {
        format!("{base}/{}/resolve/main/{}", spec.repo, spec.remote_path)
    }
}

fn retry_delay(attempt: u32) -> Duration {
    let shift = attempt.saturating_sub(1).min(3);
    let secs: u64 = 1u64 << shift;
    Duration::from_secs(secs.min(8))
}

fn manifest_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir
        .join("models")
        .join("openloop-ace-manifest.json")
}

pub fn read_manifest(app_data_dir: &Path) -> AppResult<ModelManifest> {
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

fn variant_key(variant: ModelVariant) -> String {
    match variant {
        ModelVariant::Lite => "lite",
        ModelVariant::Turbo => "turbo",
        ModelVariant::Pro => "pro",
    }
    .to_owned()
}

fn delete_marker_path(app_data_dir: &Path, variant: ModelVariant) -> PathBuf {
    app_data_dir
        .join("models")
        .join(format!(".openloop-deleting-{}", variant_key(variant)))
}

fn write_delete_marker(app_data_dir: &Path, variant: ModelVariant) {
    let path = delete_marker_path(app_data_dir, variant);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&path, Utc::now().to_rfc3339());
}

fn clear_delete_marker(app_data_dir: &Path, variant: ModelVariant) {
    let _ = fs::remove_file(delete_marker_path(app_data_dir, variant));
}

fn read_delete_marker(app_data_dir: &Path, variant: ModelVariant) -> bool {
    delete_marker_path(app_data_dir, variant).exists()
}

fn resume_pending_deletions(app_data_dir: &Path, settings: &AppSettings) {
    for descriptor in ACE_MODEL_DESCRIPTORS {
        if read_delete_marker(app_data_dir, descriptor.variant) {
            let checkpoints_dir = checkpoints_dir_for(app_data_dir, settings);
            for spec in pack_for_descriptor(descriptor) {
                let target = checkpoints_dir.join(spec.local_path);
                if target.exists() {
                    let _ = fs::remove_file(&target);
                }
                let part = part_path(&target);
                if part.exists() {
                    let _ = fs::remove_file(&part);
                }
            }
            for model_dir_name in unique_model_dirs(pack_for_descriptor(descriptor)) {
                let dir = checkpoints_dir.join(model_dir_name);
                let _ = fs::read_dir(&dir).map(|mut iter| {
                    if iter.next().is_none() {
                        let _ = fs::remove_dir(&dir);
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn standard_pack_includes_required_layers() {
        let descriptor = descriptor_for(ModelVariant::Turbo).expect("turbo descriptor");
        let pack = pack_for_descriptor(descriptor);
        assert!(pack
            .iter()
            .any(|f| f.local_path == "acestep-v15-turbo/model.safetensors"));
        assert!(pack
            .iter()
            .any(|f| f.local_path == "acestep-5Hz-lm-0.6B/model.safetensors"));
        assert!(pack
            .iter()
            .any(|f| f.local_path == "vae/diffusion_pytorch_model.safetensors"));
        assert!(pack
            .iter()
            .any(|f| f.local_path == "Qwen3-Embedding-0.6B/model.safetensors"));
    }

    #[test]
    fn xl_pack_uses_xl_files() {
        let descriptor = descriptor_for(ModelVariant::Pro).expect("pro descriptor");
        let pack = pack_for_descriptor(descriptor);
        assert!(pack
            .iter()
            .any(|f| f.local_path == "acestep-v15-xl-turbo/model-00004-of-00004.safetensors"));
        assert!(pack
            .iter()
            .any(|f| f.local_path == "acestep-5Hz-lm-1.7B/model.safetensors"));
    }

    #[test]
    fn runtime_synced_model_code_size_does_not_make_installed_pack_failed() {
        let temp = tempfile::tempdir().expect("temp dir");
        let settings = AppSettings::default();
        let descriptor = descriptor_for(ModelVariant::Turbo).expect("turbo descriptor");
        let checkpoints_dir = checkpoints_dir_for(temp.path(), &settings);

        for spec in pack_for_descriptor(descriptor) {
            let path = checkpoints_dir.join(spec.local_path);
            fs::create_dir_all(path.parent().expect("spec should have parent"))
                .expect("parent dir");
            let file = fs::File::create(&path).expect("model file");
            if is_runtime_synced_model_code(&spec) {
                file.set_len(1).expect("runtime synced code marker");
            } else {
                file.set_len(spec.size).expect("model asset size");
            }
        }
        record_install(temp.path(), descriptor).expect("install manifest");

        let snapshot = inspect_descriptor_for(temp.path(), &settings, descriptor);

        assert!(matches!(snapshot.state, ModelDownloadState::Ready));
        assert_eq!(snapshot.downloaded_bytes, snapshot.total_bytes.unwrap());
        assert!(snapshot.error.is_none());
    }

    #[test]
    fn pack_total_size_matches_descriptor_estimate() {
        for descriptor in ACE_MODEL_DESCRIPTORS {
            let total: u64 = pack_for_descriptor(descriptor).iter().map(|f| f.size).sum();
            assert_eq!(total, descriptor.estimated_size_bytes);
        }
    }
}
