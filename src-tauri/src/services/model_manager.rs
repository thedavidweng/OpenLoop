use std::{
    collections::BTreeMap,
    fs::{self, OpenOptions},
    io::Write,
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
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::models::{
    errors::{AppError, AppResult},
    settings::{AppSettings, ModelVariant},
};
use crate::services::model_bootstrap::{checkpoints_dir_for, descriptor_for};

/// Event channel used to broadcast download progress to the frontend.
pub const MODEL_DOWNLOAD_EVENT: &str = "model-download-progress";

/// Hugging Face mirror used as the canonical source for ACE-Step weights.
const HF_RESOLVE_BASE: &str = "https://huggingface.co";
const PART_SUFFIX: &str = ".openloop-part";
/// Minimum interval between progress events to keep the UI thread relaxed.
const PROGRESS_EVENT_INTERVAL: Duration = Duration::from_millis(150);

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelDownloadState {
    NotInstalled,
    Downloading,
    Ready,
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
    pub installed_at: Option<String>,
    pub error: Option<AppError>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ModelManifest {
    updated_at: String,
    installed: BTreeMap<String, InstalledModelManifest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstalledModelManifest {
    model_name: String,
    lm_model: Option<String>,
    installed_at: String,
}

#[derive(Debug)]
pub struct ModelManager {
    app_data_dir: PathBuf,
    status: Arc<Mutex<Vec<ModelStatusSnapshot>>>,
    in_flight: Arc<Mutex<Vec<(ModelVariant, Arc<AtomicBool>)>>>,
}

impl ModelManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let manager = Self {
            app_data_dir,
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
                            error: Some(AppError::model_download_failed(
                                "Download cancelled.",
                            )),
                        };
                        publish_snapshot(&app, &status, cancelled);
                    } else {
                        let final_snapshot = match result {
                            Ok(()) => {
                                if let Err(error) =
                                    record_install(&app_data_dir, descriptor)
                                {
                                    eprintln!(
                                        "openloop: failed to persist model install manifest: {}",
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
                                eprintln!(
                                    "openloop: model download for {:?} failed: {}",
                                    variant, error.message
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

            download_single_file_blocking(&client, spec, &target)?;
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
            total_bytes: Some(
                pack_for_descriptor(descriptor)
                    .iter()
                    .map(|f| f.size)
                    .sum(),
            ),
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
                let checkpoints_dir =
                    checkpoints_dir_for(&app_data_dir, &settings_for_blocking);
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

                for model_dir_name in
                    unique_model_dirs(pack_for_descriptor(descriptor))
                {
                    let dir = checkpoints_dir.join(model_dir_name);
                    let _ = fs::read_dir(&dir).map(|mut iter| {
                        if iter.next().is_none() {
                            let _ = fs::remove_dir(&dir);
                        }
                    });
                }

                let mut manifest =
                    read_manifest(&app_data_dir).unwrap_or_default();
                manifest.installed.remove(&variant_key);
                manifest.updated_at = Utc::now().to_rfc3339();
                write_manifest(&app_data_dir, &manifest).ok();
            })
            .await;

            clear_delete_marker(&app_data_dir_for_final, variant);

            if let Err(error) = result {
                eprintln!(
                    "openloop: model delete for {:?} panicked: {error}",
                    variant
                );
            }

            let final_snapshot = inspect_descriptor_for(
                &app_data_dir_for_final,
                &settings_for_final,
                descriptor,
            );
            publish_snapshot(
                &app,
                &status,
                final_snapshot,
            );
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

#[derive(Debug, Clone, Copy)]
struct ModelFileSpec {
    /// Hugging Face repository identifier, for example `ACE-Step/Ace-Step1.5`.
    repo: &'static str,
    /// Path of the file inside the Hugging Face repository.
    remote_path: &'static str,
    /// Path relative to the user's checkpoints directory where the file lives.
    local_path: &'static str,
    /// Expected file size in bytes, taken from the Hugging Face API.
    size: u64,
}

const ACESTEP_V15_TURBO_FILES: &[ModelFileSpec] = &[
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-v15-turbo/config.json",
        local_path: "acestep-v15-turbo/config.json",
        size: 1968,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-v15-turbo/configuration_acestep_v15.py",
        local_path: "acestep-v15-turbo/configuration_acestep_v15.py",
        size: 13130,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-v15-turbo/model.safetensors",
        local_path: "acestep-v15-turbo/model.safetensors",
        size: 4_787_825_604,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-v15-turbo/modeling_acestep_v15_turbo.py",
        local_path: "acestep-v15-turbo/modeling_acestep_v15_turbo.py",
        size: 96_036,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-v15-turbo/silence_latent.pt",
        local_path: "acestep-v15-turbo/silence_latent.pt",
        size: 3_841_215,
    },
];

const ACESTEP_LM_06B_FILES: &[ModelFileSpec] = &[
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "config.json",
        local_path: "acestep-5Hz-lm-0.6B/config.json",
        size: 1386,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "model.safetensors",
        local_path: "acestep-5Hz-lm-0.6B/model.safetensors",
        size: 1_325_804_024,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "tokenizer.json",
        local_path: "acestep-5Hz-lm-0.6B/tokenizer.json",
        size: 24_321_939,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "tokenizer_config.json",
        local_path: "acestep-5Hz-lm-0.6B/tokenizer_config.json",
        size: 14_072_925,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "added_tokens.json",
        local_path: "acestep-5Hz-lm-0.6B/added_tokens.json",
        size: 2_217_787,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "merges.txt",
        local_path: "acestep-5Hz-lm-0.6B/merges.txt",
        size: 1_671_853,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "vocab.json",
        local_path: "acestep-5Hz-lm-0.6B/vocab.json",
        size: 2_776_833,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "special_tokens_map.json",
        local_path: "acestep-5Hz-lm-0.6B/special_tokens_map.json",
        size: 1_824_199,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-5Hz-lm-0.6B",
        remote_path: "chat_template.jinja",
        local_path: "acestep-5Hz-lm-0.6B/chat_template.jinja",
        size: 4168,
    },
];

const ACESTEP_LM_17B_FILES: &[ModelFileSpec] = &[
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/config.json",
        local_path: "acestep-5Hz-lm-1.7B/config.json",
        size: 1385,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/model.safetensors",
        local_path: "acestep-5Hz-lm-1.7B/model.safetensors",
        size: 3_708_521_528,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/tokenizer.json",
        local_path: "acestep-5Hz-lm-1.7B/tokenizer.json",
        size: 24_321_939,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/tokenizer_config.json",
        local_path: "acestep-5Hz-lm-1.7B/tokenizer_config.json",
        size: 14_072_925,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/added_tokens.json",
        local_path: "acestep-5Hz-lm-1.7B/added_tokens.json",
        size: 2_217_787,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/merges.txt",
        local_path: "acestep-5Hz-lm-1.7B/merges.txt",
        size: 1_671_853,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/vocab.json",
        local_path: "acestep-5Hz-lm-1.7B/vocab.json",
        size: 2_776_833,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/special_tokens_map.json",
        local_path: "acestep-5Hz-lm-1.7B/special_tokens_map.json",
        size: 1_824_199,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "acestep-5Hz-lm-1.7B/chat_template.jinja",
        local_path: "acestep-5Hz-lm-1.7B/chat_template.jinja",
        size: 4168,
    },
];

const ACESTEP_V15_XL_TURBO_FILES: &[ModelFileSpec] = &[
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "config.json",
        local_path: "acestep-v15-xl-turbo/config.json",
        size: 2407,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "configuration_acestep_v15.py",
        local_path: "acestep-v15-xl-turbo/configuration_acestep_v15.py",
        size: 13_225,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "modeling_acestep_v15_xl_turbo.py",
        local_path: "acestep-v15-xl-turbo/modeling_acestep_v15_xl_turbo.py",
        size: 103_821,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "model.safetensors.index.json",
        local_path: "acestep-v15-xl-turbo/model.safetensors.index.json",
        size: 71_471,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "model-00001-of-00004.safetensors",
        local_path: "acestep-v15-xl-turbo/model-00001-of-00004.safetensors",
        size: 4_986_971_456,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "model-00002-of-00004.safetensors",
        local_path: "acestep-v15-xl-turbo/model-00002-of-00004.safetensors",
        size: 4_986_942_776,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "model-00003-of-00004.safetensors",
        local_path: "acestep-v15-xl-turbo/model-00003-of-00004.safetensors",
        size: 4_986_942_808,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "model-00004-of-00004.safetensors",
        local_path: "acestep-v15-xl-turbo/model-00004-of-00004.safetensors",
        size: 4_988_483_464,
    },
    ModelFileSpec {
        repo: "ACE-Step/acestep-v15-xl-turbo",
        remote_path: "silence_latent.pt",
        local_path: "acestep-v15-xl-turbo/silence_latent.pt",
        size: 3_841_215,
    },
];

const SHARED_VAE_FILES: &[ModelFileSpec] = &[
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "vae/config.json",
        local_path: "vae/config.json",
        size: 425,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "vae/diffusion_pytorch_model.safetensors",
        local_path: "vae/diffusion_pytorch_model.safetensors",
        size: 337_431_388,
    },
];

const SHARED_TEXT_EMBED_FILES: &[ModelFileSpec] = &[
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/config.json",
        local_path: "Qwen3-Embedding-0.6B/config.json",
        size: 1359,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/model.safetensors",
        local_path: "Qwen3-Embedding-0.6B/model.safetensors",
        size: 1_191_586_416,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/tokenizer.json",
        local_path: "Qwen3-Embedding-0.6B/tokenizer.json",
        size: 11_423_705,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/tokenizer_config.json",
        local_path: "Qwen3-Embedding-0.6B/tokenizer_config.json",
        size: 5404,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/added_tokens.json",
        local_path: "Qwen3-Embedding-0.6B/added_tokens.json",
        size: 707,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/merges.txt",
        local_path: "Qwen3-Embedding-0.6B/merges.txt",
        size: 1_671_853,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/vocab.json",
        local_path: "Qwen3-Embedding-0.6B/vocab.json",
        size: 2_776_833,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/special_tokens_map.json",
        local_path: "Qwen3-Embedding-0.6B/special_tokens_map.json",
        size: 613,
    },
    ModelFileSpec {
        repo: "ACE-Step/Ace-Step1.5",
        remote_path: "Qwen3-Embedding-0.6B/chat_template.jinja",
        local_path: "Qwen3-Embedding-0.6B/chat_template.jinja",
        size: 4116,
    },
];

const fn const_sum(slices: &[&[ModelFileSpec]]) -> u64 {
    let mut total = 0u64;
    let mut i = 0;
    while i < slices.len() {
        let slice = slices[i];
        let mut j = 0;
        while j < slice.len() {
            total += slice[j].size;
            j += 1;
        }
        i += 1;
    }
    total
}

const STANDARD_PACK_TOTAL_BYTES: u64 = const_sum(&[
    ACESTEP_V15_TURBO_FILES,
    ACESTEP_LM_06B_FILES,
    SHARED_VAE_FILES,
    SHARED_TEXT_EMBED_FILES,
]);

const XL_PACK_TOTAL_BYTES: u64 = const_sum(&[
    ACESTEP_V15_XL_TURBO_FILES,
    ACESTEP_LM_17B_FILES,
    SHARED_VAE_FILES,
    SHARED_TEXT_EMBED_FILES,
]);

fn pack_for_descriptor(descriptor: &AceModelDescriptor) -> Vec<ModelFileSpec> {
    let mut files: Vec<ModelFileSpec> = Vec::new();
    match descriptor.model_name {
        "acestep-v15-turbo" => files.extend_from_slice(ACESTEP_V15_TURBO_FILES),
        "acestep-v15-xl-turbo" => files.extend_from_slice(ACESTEP_V15_XL_TURBO_FILES),
        _ => {}
    }
    match descriptor.lm_model {
        Some("acestep-5Hz-lm-0.6B") => files.extend_from_slice(ACESTEP_LM_06B_FILES),
        Some("acestep-5Hz-lm-1.7B") => files.extend_from_slice(ACESTEP_LM_17B_FILES),
        _ => {}
    }
    files.extend_from_slice(SHARED_VAE_FILES);
    files.extend_from_slice(SHARED_TEXT_EMBED_FILES);
    files
}

fn unique_model_dirs(files: Vec<ModelFileSpec>) -> Vec<&'static str> {
    let mut dirs: Vec<&'static str> = Vec::new();
    for spec in files {
        let top = spec.local_path.split('/').next().unwrap_or(spec.local_path);
        if !dirs.contains(&top) {
            dirs.push(top);
        }
    }
    dirs
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
    // Multi-gigabyte downloads cannot use a total `timeout()` because they
    // legitimately take many minutes. Instead we cap the *connect* phase and
    // the gap between successive bytes from the server, so a stalled
    // connection is detected without aborting healthy downloads.
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

async fn download_pack(
    app: &AppHandle,
    app_data_dir: &Path,
    settings: &AppSettings,
    descriptor: &AceModelDescriptor,
    files: Vec<ModelFileSpec>,
    total_bytes: u64,
    status: &Arc<Mutex<Vec<ModelStatusSnapshot>>>,
    cancel: &Arc<AtomicBool>,
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

    // Push an immediate snapshot so the UI sees movement before the network
    // wake-up, and starts off knowing the total pack size.
    emit_progress(0, true);

    for spec in &files {
        if cancel.load(Ordering::SeqCst) {
            return Err(AppError::model_download_failed(
                "Download cancelled.",
            ));
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

        download_single_file(&client, spec, &target, |bytes_in_file| {
            emit_progress(bytes_in_file, false)
        })
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
    mut on_progress: F,
) -> AppResult<()>
where
    F: FnMut(u64),
{
    let url = format!(
        "{HF_RESOLVE_BASE}/{repo}/resolve/main/{path}",
        repo = spec.repo,
        path = spec.remote_path
    );

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

    // A small retry loop covers transient TCP resets and HTTP 5xx hiccups
    // that are common on large downloads. Each attempt resumes from the
    // current part-file size so we never re-download bytes already on disk.
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
            Ok(response) => response,
            Err(error) => {
                let message = format!(
                    "failed to request {repo}/{path}: {error}",
                    repo = spec.repo,
                    path = spec.remote_path
                );
                if attempt >= MAX_ATTEMPTS {
                    return Err(AppError::model_download_failed(message));
                }
                eprintln!("openloop: {} (retry {attempt}/{MAX_ATTEMPTS})", message);
                last_error = Some(AppError::model_download_failed(message));
                tokio::time::sleep(retry_delay(attempt)).await;
                // Refresh size in case partial bytes landed in the file.
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
            // Server errors are worth retrying; client errors usually are not.
            if status_code.is_server_error() && attempt < MAX_ATTEMPTS {
                eprintln!("openloop: {} (retry {attempt}/{MAX_ATTEMPTS})", message);
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
            eprintln!(
                "openloop: {} (retry {attempt}/{MAX_ATTEMPTS})",
                error.message
            );
            last_error = Some(error);
            tokio::time::sleep(retry_delay(attempt)).await;
            // Reflect actual on-disk progress before retrying.
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
            eprintln!("openloop: {} (retry {attempt}/{MAX_ATTEMPTS})", message);
            last_error = Some(AppError::model_download_failed(message));
            tokio::time::sleep(retry_delay(attempt)).await;
            continue;
        }

        break;
    }

    let _ = last_error; // last_error retained for diagnostics if needed
    fs::rename(&part, target).map_err(|error| {
        AppError::model_download_failed(format!(
            "failed to move temporary download {} to {}: {error}",
            part.display(),
            target.display()
        ))
    })?;

    on_progress(spec.size);
    Ok(())
}

fn download_single_file_blocking(
    client: &reqwest::blocking::Client,
    spec: &ModelFileSpec,
    target: &Path,
) -> AppResult<()> {
    use std::io::Read;

    let url = format!(
        "{HF_RESOLVE_BASE}/{repo}/resolve/main/{path}",
        repo = spec.repo,
        path = spec.remote_path
    );

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
            Ok(response) => response,
            Err(error) => {
                let message = format!(
                    "failed to request {repo}/{path}: {error}",
                    repo = spec.repo,
                    path = spec.remote_path
                );
                if attempt >= MAX_ATTEMPTS {
                    return Err(AppError::model_download_failed(message));
                }
                eprintln!("openloop: {} (retry {attempt}/{MAX_ATTEMPTS})", message);
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
                eprintln!("openloop: {} (retry {attempt}/{MAX_ATTEMPTS})", message);
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
                    eprintln!(
                        "openloop: stream error for {}/{}: {error} (retry {attempt}/{MAX_ATTEMPTS})",
                        spec.repo, spec.remote_path
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
            eprintln!("openloop: {} (retry {attempt}/{MAX_ATTEMPTS})", message);
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

    Ok(())
}

fn retry_delay(attempt: u32) -> Duration {
    // Exponential back-off capped at 8 seconds: 1s, 2s, 4s, 8s.
    let shift = attempt.saturating_sub(1).min(3);
    let secs: u64 = 1u64 << shift;
    Duration::from_secs(secs.min(8))
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
    use crate::services::model_bootstrap::{checkpoints_dir_for, descriptor_for};

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
