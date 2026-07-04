pub mod delete;
pub mod download;
pub mod manifest;
pub mod mirror;
pub mod specs;
pub mod types;

pub use specs::*;
pub use types::*;
// Re-export public helpers consumed outside the crate (cli/pull, cli/models, cli/doctor).
pub use manifest::read_manifest;

use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

use tauri::AppHandle;

use crate::{
    models::{
        errors::{AppError, AppResult},
        settings::{AppSettings, ModelVariant},
    },
    services::{model_bootstrap::checkpoints_dir_for, network_log::NetworkActivityLog},
};

use super::model_bootstrap::descriptor_for;

use delete::{
    clear_partial_downloads, emit_delete_started, forget_variant_in_manifest, remove_variant_files,
};
use download::{
    blocking_http_client, download_pack, download_single_file_blocking, downloading_snapshot,
    failed_snapshot_for, inspect_descriptor_for, publish_snapshot,
};
use manifest::{
    clear_delete_marker, record_install, resume_pending_deletions, write_delete_marker,
};

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
    network_log: Arc<NetworkActivityLog>,
    status: Arc<Mutex<Vec<ModelStatusSnapshot>>>,
    #[allow(clippy::type_complexity)]
    in_flight: Arc<Mutex<Vec<(ModelVariant, Arc<AtomicBool>)>>>,
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
                    download::upsert_snapshot(&mut snapshots, current.clone());
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

        // Cancel any prior in-flight download for the same variant.
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
                            let part = download::part_path(&checkpoints_dir.join(spec.local_path));
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
        emit_delete_started(&app, &self.status, descriptor);

        write_delete_marker(&self.app_data_dir, variant);

        let app_data_dir = self.app_data_dir.clone();
        let settings_for_blocking = settings.clone();
        let settings_for_final = settings.clone();
        let app_data_dir_for_final = self.app_data_dir.clone();
        let status = Arc::clone(&self.status);
        let variant_for_key = variant;

        tauri::async_runtime::spawn(async move {
            let result = tokio::task::spawn_blocking(move || {
                remove_variant_files(&app_data_dir, &settings_for_blocking, descriptor);
                forget_variant_in_manifest(&app_data_dir, variant_for_key);
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

        // Return the "delete started" snapshot mirroring the prior contract.
        Ok(ModelStatusSnapshot {
            variant: descriptor.variant,
            state: ModelDownloadState::NotInstalled,
            model_name: descriptor.model_name.to_owned(),
            label: descriptor.label.to_owned(),
            description: descriptor.description.to_owned(),
            downloaded_bytes: 0,
            total_bytes: Some(pack_for_descriptor(descriptor).iter().map(|f| f.size).sum()),
            installed_at: None,
            error: None,
        })
    }

    pub fn clear_partial_downloads(
        &self,
        settings: &AppSettings,
        variant: ModelVariant,
    ) -> AppResult<ModelStatusSnapshot> {
        clear_partial_downloads(&self.app_data_dir, settings, variant)
    }

    pub fn delete_all(&self, settings: &AppSettings) -> Vec<ModelStatusSnapshot> {
        let snapshots = delete::delete_all(&self.app_data_dir, settings);
        if let Ok(mut guard) = self.status.lock() {
            *guard = snapshots.clone();
        }
        snapshots
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::model_bootstrap::checkpoints_dir_for;

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
            if download::is_runtime_synced_model_code(&spec) {
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
