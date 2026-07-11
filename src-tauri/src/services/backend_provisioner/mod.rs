mod archive;
mod download;
mod helpers;
mod manifest;
mod migration;
mod release;
mod types;

use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

use chrono::Utc;
use reqwest::Client;
use tauri::AppHandle;

use crate::models::errors::{AppError, AppResult};
use crate::services::network_log::NetworkActivityLog;

pub use types::{
    BackendManifest, BackendProvisionState, BackendProvisionStatus, BACKEND_PROVISION_EVENT,
};

use archive::extract_archive;
use download::{
    blocking_http_client, download_archive_async, download_archive_blocking, http_client,
};
use helpers::{backup_runtime_code, emit_status, manifest_migration_warning};
use manifest::write_backend_manifest;
use migration::read_git_head;
use release::{fetch_latest_release_async, fetch_latest_release_blocking};
use types::{BACKEND_MANIFEST_FILENAME, PINNED_COMMIT};

// Re-export for external callers (cli/backend.rs, cli/doctor.rs)
pub use manifest::read_backend_manifest;

// ---------------------------------------------------------------------------
// BackendProvisioner
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub struct BackendProvisioner {
    app_data_dir: PathBuf,
    status: Arc<Mutex<BackendProvisionStatus>>,
    network_log: Arc<NetworkActivityLog>,
}

impl BackendProvisioner {
    pub fn new(app_data_dir: PathBuf, network_log: Arc<NetworkActivityLog>) -> Self {
        let provisioner = Self {
            app_data_dir,
            status: Arc::new(Mutex::new(BackendProvisionStatus::default())),
            network_log,
        };
        // Migration: detect existing git-cloned backend
        provisioner.migrate_existing_backend();
        // Initialize status from manifest
        if let Some(manifest) = read_backend_manifest(&provisioner.app_data_dir) {
            if let Ok(mut status) = provisioner.status.lock() {
                status.state = BackendProvisionState::Ready;
                status.installed_commit = Some(manifest.installed_commit.clone());
                status.installed_tag = manifest.installed_tag.clone();
            }
        }
        provisioner
    }

    /// Check if backend code is provisioned (manifest exists + runtime dir has pyproject.toml).
    pub fn is_provisioned(&self) -> bool {
        let runtime_dir = self.runtime_dir();
        let manifest_path = self.manifest_path();
        manifest_path.exists() && runtime_dir.join("pyproject.toml").exists()
    }

    /// Get current status.
    pub fn status(&self) -> BackendProvisionStatus {
        if let Ok(status) = self.status.lock() {
            status.clone()
        } else {
            BackendProvisionStatus::default()
        }
    }

    /// Blocking provision for CLI.
    pub fn provision_blocking(&self) -> AppResult<()> {
        let git_ref = PINNED_COMMIT;
        let runtime_dir = self.runtime_dir();

        fs::create_dir_all(&runtime_dir).map_err(|error| {
            AppError::backend_provision_failed(format!(
                "failed to create runtime directory {}: {error}",
                runtime_dir.display()
            ))
        })?;

        let client = blocking_http_client()?;
        let archive_path = runtime_dir.join(format!("acestep-{git_ref}.zip"));

        // Download
        download_archive_blocking(&client, git_ref, &archive_path, &self.network_log)?;

        // Extract
        extract_archive(&archive_path, &runtime_dir)?;
        if let Err(e) = fs::remove_file(&archive_path) {
            tracing::warn!("Failed to clean up archive after extraction: {e}");
        }

        // Write manifest
        let manifest = BackendManifest {
            installed_commit: git_ref.to_owned(),
            installed_tag: None,
            installed_at: Utc::now().to_rfc3339(),
        };
        write_backend_manifest(&self.app_data_dir, &manifest)?;

        if let Ok(mut status) = self.status.lock() {
            *status = BackendProvisionStatus {
                state: BackendProvisionState::Ready,
                installed_commit: Some(git_ref.to_owned()),
                ..Default::default()
            };
        }

        Ok(())
    }

    /// Async provision with progress events for GUI.
    pub fn provision(&self, app: AppHandle) -> AppResult<()> {
        let git_ref = PINNED_COMMIT;
        let runtime_dir = self.runtime_dir();
        let status = Arc::clone(&self.status);
        let app_data_dir = self.app_data_dir.clone();
        let network_log = Arc::clone(&self.network_log);

        fs::create_dir_all(&runtime_dir).map_err(|error| {
            AppError::backend_provision_failed(format!(
                "failed to create runtime directory {}: {error}",
                runtime_dir.display()
            ))
        })?;

        // Set downloading state
        if let Ok(mut s) = status.lock() {
            s.state = BackendProvisionState::Downloading;
            s.downloaded_bytes = 0;
            s.total_bytes = None;
            s.error = None;
        }
        emit_status(&app, &status);

        tauri::async_runtime::spawn(async move {
            let result = provision_async_inner(
                &app,
                &app_data_dir,
                &runtime_dir,
                git_ref,
                &status,
                Arc::clone(&network_log),
            )
            .await;

            match result {
                Ok(()) => {
                    let manifest = BackendManifest {
                        installed_commit: git_ref.to_owned(),
                        installed_tag: None,
                        installed_at: Utc::now().to_rfc3339(),
                    };
                    if let Err(e) = write_backend_manifest(&app_data_dir, &manifest) {
                        tracing::error!("failed to write backend manifest: {}", e.message);
                    }
                    if let Ok(mut s) = status.lock() {
                        *s = BackendProvisionStatus {
                            state: BackendProvisionState::Ready,
                            installed_commit: Some(git_ref.to_owned()),
                            ..Default::default()
                        };
                    }
                }
                Err(error) => {
                    tracing::error!("backend provision failed: {}", error.message);
                    if let Ok(mut s) = status.lock() {
                        s.state = BackendProvisionState::Failed;
                        s.error = Some(error);
                    }
                }
            }

            emit_status(&app, &status);
        });

        Ok(())
    }

    /// Check for updates against remote GitHub releases.
    pub fn check_for_updates(&self) -> AppResult<BackendProvisionStatus> {
        let local = read_backend_manifest(&self.app_data_dir);

        // Try to fetch latest release info
        let (latest_tag, latest_commit) = match fetch_latest_release_blocking(&self.network_log) {
            Ok(info) => info,
            Err(_) => {
                // If we can't reach GitHub, return current status without update info
                let mut status = self.status();
                status.latest_commit = None;
                status.latest_tag = None;
                status.update_available = false;
                return Ok(status);
            }
        };

        let update_available = match &local {
            Some(manifest) => manifest.installed_commit != latest_commit,
            None => false, // Not installed, can't "update"
        };

        let mut status = self.status();
        status.latest_commit = Some(latest_commit);
        status.latest_tag = Some(latest_tag);
        status.update_available = update_available;
        Ok(status)
    }

    /// Blocking update for CLI.
    pub fn update_blocking(&self) -> AppResult<()> {
        if !self.is_provisioned() {
            return Err(AppError::backend_provision_failed(
                "backend is not installed. Run 'openloop backend provision' first.",
            ));
        }

        let (latest_tag, latest_commit) = fetch_latest_release_blocking(&self.network_log)?;
        let runtime_dir = self.runtime_dir();

        // Download to temp dir (not inside runtime) so backup_runtime_code doesn't move it
        let client = blocking_http_client()?;
        let temp_dir = std::env::temp_dir().join("openloop-backend-update");
        fs::create_dir_all(&temp_dir).map_err(|error| {
            AppError::backend_provision_failed(format!("failed to create temp directory: {error}"))
        })?;
        let archive_path = temp_dir.join(format!("acestep-{latest_commit}.zip"));
        download_archive_blocking(&client, &latest_commit, &archive_path, &self.network_log)?;

        // Backup old code to a sibling directory (not inside runtime)
        let backup_dir = runtime_dir.parent().unwrap_or(&runtime_dir).join(format!(
            "ACE-Step-1.5.backup-{}",
            Utc::now().format("%Y%m%d-%H%M%S")
        ));
        backup_runtime_code(&runtime_dir, &backup_dir)?;
        extract_archive(&archive_path, &runtime_dir)?;
        if let Err(e) = fs::remove_file(&archive_path) {
            tracing::warn!("Failed to clean up archive after extraction: {e}");
        }

        // Update manifest
        let manifest = BackendManifest {
            installed_commit: latest_commit.clone(),
            installed_tag: Some(latest_tag.clone()),
            installed_at: Utc::now().to_rfc3339(),
        };
        write_backend_manifest(&self.app_data_dir, &manifest)?;

        // Clean up backup
        if let Err(e) = fs::remove_dir_all(&backup_dir) {
            tracing::warn!("Failed to clean up backup directory: {e}");
        }

        if let Ok(mut status) = self.status.lock() {
            *status = BackendProvisionStatus {
                state: BackendProvisionState::Ready,
                installed_commit: Some(latest_commit),
                installed_tag: Some(latest_tag),
                ..Default::default()
            };
        }

        Ok(())
    }

    /// Async update with progress events for GUI.
    pub fn update(&self, app: AppHandle) -> AppResult<()> {
        if !self.is_provisioned() {
            return Err(AppError::backend_provision_failed(
                "backend is not installed. Run provision first.",
            ));
        }

        let status = Arc::clone(&self.status);
        let app_data_dir = self.app_data_dir.clone();
        let runtime_dir = self.runtime_dir();
        let network_log = Arc::clone(&self.network_log);

        if let Ok(mut s) = status.lock() {
            s.state = BackendProvisionState::Downloading;
            s.downloaded_bytes = 0;
            s.total_bytes = None;
            s.error = None;
        }
        emit_status(&app, &status);

        tauri::async_runtime::spawn(async move {
            let result = update_async_inner(
                &app,
                &app_data_dir,
                &runtime_dir,
                &status,
                Arc::clone(&network_log),
            )
            .await;

            match result {
                Ok((tag, commit)) => {
                    if let Ok(mut s) = status.lock() {
                        *s = BackendProvisionStatus {
                            state: BackendProvisionState::Ready,
                            installed_commit: Some(commit),
                            installed_tag: Some(tag),
                            ..Default::default()
                        };
                    }
                }
                Err(error) => {
                    tracing::error!("backend update failed: {}", error.message);
                    if let Ok(mut s) = status.lock() {
                        s.state = BackendProvisionState::Failed;
                        s.error = Some(error);
                    }
                }
            }

            emit_status(&app, &status);
        });

        Ok(())
    }

    fn runtime_dir(&self) -> PathBuf {
        self.app_data_dir.join("runtime").join("ACE-Step-1.5")
    }

    fn manifest_path(&self) -> PathBuf {
        self.app_data_dir
            .join("runtime")
            .join(BACKEND_MANIFEST_FILENAME)
    }

    /// Detect existing git-cloned backend and write manifest for migration.
    fn migrate_existing_backend(&self) {
        let runtime_dir = self.runtime_dir();
        let manifest_path = self.manifest_path();

        // Skip if manifest already exists
        if manifest_path.exists() {
            return;
        }

        // Check for .git directory (indicates manual git clone)
        let git_dir = runtime_dir.join(".git");
        if !git_dir.exists() {
            return;
        }

        // Try to read commit SHA from .git/HEAD
        let commit = read_git_head(&runtime_dir);
        if let Some(commit) = commit {
            let manifest = BackendManifest {
                installed_commit: commit,
                installed_tag: None,
                installed_at: Utc::now().to_rfc3339(),
            };
            if let Err(e) = write_backend_manifest(&self.app_data_dir, &manifest) {
                tracing::warn!("{}", manifest_migration_warning(&e));
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Async provision/update internals
// ---------------------------------------------------------------------------

async fn provision_async_inner(
    app: &AppHandle,
    _app_data_dir: &Path,
    runtime_dir: &Path,
    git_ref: &str,
    status: &Arc<Mutex<BackendProvisionStatus>>,
    network_log: Arc<NetworkActivityLog>,
) -> AppResult<()> {
    let client: Client = http_client()?;
    let archive_path = runtime_dir.join(format!("acestep-{git_ref}.zip"));

    // Download with progress
    let total = download_archive_async(
        &client,
        git_ref,
        &archive_path,
        Arc::clone(&network_log),
        |downloaded| {
            if let Ok(mut s) = status.lock() {
                s.downloaded_bytes = downloaded;
            }
            emit_status(app, status);
        },
    )
    .await?;

    if let Ok(mut s) = status.lock() {
        s.state = BackendProvisionState::Extracting;
        s.total_bytes = Some(total);
    }
    emit_status(app, status);

    // Extract
    extract_archive(&archive_path, runtime_dir)?;
    if let Err(e) = fs::remove_file(&archive_path) {
        tracing::warn!("Failed to clean up archive after extraction: {e}");
    }

    Ok(())
}

async fn update_async_inner(
    app: &AppHandle,
    app_data_dir: &Path,
    runtime_dir: &Path,
    status: &Arc<Mutex<BackendProvisionStatus>>,
    network_log: Arc<NetworkActivityLog>,
) -> AppResult<(String, String)> {
    let (latest_tag, latest_commit) = fetch_latest_release_async(Arc::clone(&network_log)).await?;

    // Download to temp dir (not inside runtime) so backup_runtime_code doesn't move it
    let client = http_client()?;
    let temp_dir = std::env::temp_dir().join("openloop-backend-update");
    fs::create_dir_all(&temp_dir).map_err(|error| {
        AppError::backend_provision_failed(format!("failed to create temp directory: {error}"))
    })?;
    let archive_path = temp_dir.join(format!("acestep-{latest_commit}.zip"));

    // Download with progress
    let total = download_archive_async(
        &client,
        &latest_commit,
        &archive_path,
        Arc::clone(&network_log),
        |downloaded| {
            if let Ok(mut s) = status.lock() {
                s.downloaded_bytes = downloaded;
            }
            emit_status(app, status);
        },
    )
    .await?;

    if let Ok(mut s) = status.lock() {
        s.state = BackendProvisionState::Extracting;
        s.total_bytes = Some(total);
    }
    emit_status(app, status);

    // Backup old code to a sibling directory (not inside runtime)
    let backup_dir = runtime_dir.parent().unwrap_or(runtime_dir).join(format!(
        "ACE-Step-1.5.backup-{}",
        Utc::now().format("%Y%m%d-%H%M%S")
    ));
    backup_runtime_code(runtime_dir, &backup_dir)?;

    // Extract new
    extract_archive(&archive_path, runtime_dir)?;
    if let Err(e) = fs::remove_file(&archive_path) {
        tracing::warn!("Failed to clean up archive after extraction: {e}");
    }

    // Update manifest
    let manifest = BackendManifest {
        installed_commit: latest_commit.clone(),
        installed_tag: Some(latest_tag.clone()),
        installed_at: Utc::now().to_rfc3339(),
    };
    write_backend_manifest(app_data_dir, &manifest)?;

    // Clean up backup
    if let Err(e) = fs::remove_dir_all(&backup_dir) {
        tracing::warn!("Failed to clean up backup directory: {e}");
    }

    Ok((latest_tag, latest_commit))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::network_log::NetworkActivityLog;
    use download::flush_archive_error;
    use helpers::provision_status_emit_warning;
    use std::io::Write as _;

    #[test]
    fn new_provisioner_with_no_manifest_reports_not_installed() {
        let temp = tempfile::tempdir().expect("temp dir");
        let provisioner = BackendProvisioner::new(
            temp.path().to_path_buf(),
            Arc::new(NetworkActivityLog::new()),
        );
        assert!(!provisioner.is_provisioned());
        let status = provisioner.status();
        assert_eq!(status.state, BackendProvisionState::NotInstalled);
    }

    #[test]
    fn new_provisioner_with_manifest_reports_ready() {
        let temp = tempfile::tempdir().expect("temp dir");
        let runtime = temp.path().join("runtime").join("ACE-Step-1.5");
        fs::create_dir_all(&runtime).expect("create runtime");
        fs::write(runtime.join("pyproject.toml"), b"[project]\nname = 'test'")
            .expect("write pyproject");

        let manifest = BackendManifest {
            installed_commit: "abc1234".to_owned(),
            installed_tag: Some("v1.5.0".to_owned()),
            installed_at: Utc::now().to_rfc3339(),
        };
        write_backend_manifest(temp.path(), &manifest).expect("write manifest");

        let provisioner = BackendProvisioner::new(
            temp.path().to_path_buf(),
            Arc::new(NetworkActivityLog::new()),
        );
        assert!(provisioner.is_provisioned());
        let status = provisioner.status();
        assert_eq!(status.state, BackendProvisionState::Ready);
        assert_eq!(status.installed_commit.as_deref(), Some("abc1234"));
        assert_eq!(status.installed_tag.as_deref(), Some("v1.5.0"));
    }

    #[test]
    fn migration_detects_git_clone() {
        let temp = tempfile::tempdir().expect("temp dir");
        let runtime = temp.path().join("runtime").join("ACE-Step-1.5");
        let git_dir = runtime.join(".git");
        fs::create_dir_all(&git_dir).expect("create git dir");
        fs::write(git_dir.join("HEAD"), "abc1234567890abcdef\n").expect("write HEAD");

        // Manifest should be written on construction
        let _provisioner = BackendProvisioner::new(
            temp.path().to_path_buf(),
            Arc::new(NetworkActivityLog::new()),
        );

        let manifest = read_backend_manifest(temp.path());
        assert!(manifest.is_some());
        let manifest = manifest.unwrap();
        assert_eq!(manifest.installed_commit, "abc1234567890abcdef");
    }

    #[test]
    fn extract_archive_strips_top_level_prefix() {
        let temp = tempfile::tempdir().expect("temp dir");
        let runtime_dir = temp.path().join("runtime");
        fs::create_dir_all(&runtime_dir).expect("create runtime");

        // Create a simple zip with a top-level directory
        let zip_path = temp.path().join("test.zip");
        let zip_file = fs::File::create(&zip_path).expect("create zip");
        let mut zip = zip::ZipWriter::new(zip_file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);

        zip.start_file("ACE-Step-1.5-abc123/pyproject.toml", options.clone())
            .expect("start file");
        zip.write_all(b"[project]\nname = 'acestep'")
            .expect("write file");
        zip.start_file("ACE-Step-1.5-abc123/acestep/__init__.py", options)
            .expect("start file");
        zip.write_all(b"").expect("write file");
        zip.finish().expect("finish zip");

        extract_archive(&zip_path, &runtime_dir).expect("extract");

        assert!(runtime_dir.join("pyproject.toml").exists());
        assert!(runtime_dir.join("acestep/__init__.py").exists());
        // The prefix directory should NOT exist
        assert!(!runtime_dir.join("ACE-Step-1.5-abc123").exists());
    }

    #[test]
    fn resolve_path_within_base_rejects_parent_dir_components() {
        let temp = tempfile::tempdir().expect("temp dir");
        let base = fs::canonicalize(temp.path()).expect("canonical base");

        let error = archive::resolve_path_within_base(&base, "nested/../../outside.txt")
            .expect_err("reject parent dir");
        assert!(error
            .details
            .as_deref()
            .unwrap_or("")
            .contains("unsafe path component"));
    }

    #[test]
    fn resolve_path_within_base_allows_nested_paths() {
        let temp = tempfile::tempdir().expect("temp dir");
        let base = fs::canonicalize(temp.path()).expect("canonical base");

        let resolved = archive::resolve_path_within_base(&base, "acestep/__init__.py")
            .expect("resolve nested path");
        assert_eq!(resolved, base.join("acestep").join("__init__.py"));
    }

    #[test]
    fn provision_warning_messages_include_error_text() {
        let error = AppError::new("TEST", "emit failed", None, true);
        assert!(manifest_migration_warning(&error).contains("emit failed"));
        assert!(provision_status_emit_warning(&"emit failed").contains("emit failed"));
    }

    #[test]
    fn flush_archive_error_includes_details() {
        let error = flush_archive_error("disk full");
        assert!(error.details.as_deref().unwrap_or("").contains("disk full"));
    }
}
