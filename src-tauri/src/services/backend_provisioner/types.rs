use serde::{Deserialize, Serialize};

use crate::models::errors::AppError;

/// Event channel for frontend progress updates.
pub const BACKEND_PROVISION_EVENT: &str = "backend-provision-progress";

pub const ACE_STEP_REPO: &str = "ACE-Step/ACE-Step-1.5";
pub const PINNED_COMMIT: &str = "d5d958e";
pub const BACKEND_MANIFEST_FILENAME: &str = "backend-manifest.json";
pub const PART_SUFFIX: &str = ".openloop-part";
pub const MAX_ATTEMPTS: u32 = 4;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendManifest {
    pub installed_commit: String,
    pub installed_tag: Option<String>,
    pub installed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BackendProvisionState {
    NotInstalled,
    Downloading,
    Extracting,
    Ready,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendProvisionStatus {
    pub state: BackendProvisionState,
    pub installed_commit: Option<String>,
    pub installed_tag: Option<String>,
    pub latest_commit: Option<String>,
    pub latest_tag: Option<String>,
    pub update_available: bool,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub error: Option<AppError>,
}

impl Default for BackendProvisionStatus {
    fn default() -> Self {
        Self {
            state: BackendProvisionState::NotInstalled,
            installed_commit: None,
            installed_tag: None,
            latest_commit: None,
            latest_tag: None,
            update_available: false,
            downloaded_bytes: 0,
            total_bytes: None,
            error: None,
        }
    }
}
