use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::models::{
    errors::AppError,
    settings::ModelVariant,
};

/// Event channel used to broadcast download progress to the frontend.
pub const MODEL_DOWNLOAD_EVENT: &str = "model-download-progress";

/// Hugging Face mirror used as the canonical source for ACE-Step weights.
pub const HF_RESOLVE_BASE: &str = "https://huggingface.co";
pub const PART_SUFFIX: &str = ".openloop-part";
/// Minimum interval between progress events to keep the UI thread relaxed.
pub const PROGRESS_EVENT_INTERVAL: Duration = Duration::from_millis(150);

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
pub struct ModelManifest {
    pub updated_at: String,
    pub installed: std::collections::BTreeMap<String, InstalledModelManifest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledModelManifest {
    pub model_name: String,
    pub lm_model: Option<String>,
    pub installed_at: String,
}

#[derive(Debug, Clone, Copy)]
pub struct ModelFileSpec {
    /// Hugging Face repository identifier, for example `ACE-Step/Ace-Step1.5`.
    pub repo: &'static str,
    /// Path of the file inside the Hugging Face repository.
    pub remote_path: &'static str,
    /// Path relative to the user's checkpoints directory where the file lives.
    pub local_path: &'static str,
    /// Expected file size in bytes, taken from the Hugging Face API.
    pub size: u64,
    /// Expected SHA256 hex digest. When `None`, integrity verification is skipped.
    pub sha256: Option<&'static str>,
}
