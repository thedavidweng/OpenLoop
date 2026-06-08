use std::{
    fs::{self, OpenOptions},
    io::Write as _,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Duration,
};

use chrono::Utc;
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::models::errors::{AppError, AppResult};

/// Event channel for frontend progress updates.
pub const BACKEND_PROVISION_EVENT: &str = "backend-provision-progress";

const ACE_STEP_REPO: &str = "ACE-Step/ACE-Step-1.5";
const PINNED_COMMIT: &str = "d5d958e";
const BACKEND_MANIFEST_FILENAME: &str = "backend-manifest.json";
const PART_SUFFIX: &str = ".openloop-part";
const MAX_ATTEMPTS: u32 = 4;

fn retry_delay(attempt: u32) -> Duration {
    Duration::from_secs(2u64.pow(attempt.min(5)))
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// BackendProvisioner
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub struct BackendProvisioner {
    app_data_dir: PathBuf,
    status: Arc<Mutex<BackendProvisionStatus>>,
}

impl BackendProvisioner {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let provisioner = Self {
            app_data_dir,
            status: Arc::new(Mutex::new(BackendProvisionStatus::default())),
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
        download_archive_blocking(&client, git_ref, &archive_path)?;

        // Extract
        extract_archive(&archive_path, &runtime_dir)?;
        let _ = fs::remove_file(&archive_path);

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
            let result =
                provision_async_inner(&app, &app_data_dir, &runtime_dir, git_ref, &status).await;

            match result {
                Ok(()) => {
                    let manifest = BackendManifest {
                        installed_commit: git_ref.to_owned(),
                        installed_tag: None,
                        installed_at: Utc::now().to_rfc3339(),
                    };
                    if let Err(e) = write_backend_manifest(&app_data_dir, &manifest) {
                        eprintln!("openloop: failed to write backend manifest: {}", e.message);
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
                    eprintln!("openloop: backend provision failed: {}", error.message);
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
        let (latest_tag, latest_commit) = match fetch_latest_release_blocking() {
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

        let (latest_tag, latest_commit) = fetch_latest_release_blocking()?;
        let runtime_dir = self.runtime_dir();

        // Download to temp dir (not inside runtime) so backup_runtime_code doesn't move it
        let client = blocking_http_client()?;
        let temp_dir = std::env::temp_dir().join("openloop-backend-update");
        fs::create_dir_all(&temp_dir).map_err(|error| {
            AppError::backend_provision_failed(format!("failed to create temp directory: {error}"))
        })?;
        let archive_path = temp_dir.join(format!("acestep-{latest_commit}.zip"));
        download_archive_blocking(&client, &latest_commit, &archive_path)?;

        // Backup old code to a sibling directory (not inside runtime)
        let backup_dir = runtime_dir.parent().unwrap_or(&runtime_dir).join(format!(
            "ACE-Step-1.5.backup-{}",
            Utc::now().format("%Y%m%d-%H%M%S")
        ));
        backup_runtime_code(&runtime_dir, &backup_dir)?;
        extract_archive(&archive_path, &runtime_dir)?;
        let _ = fs::remove_file(&archive_path);

        // Update manifest
        let manifest = BackendManifest {
            installed_commit: latest_commit.clone(),
            installed_tag: Some(latest_tag.clone()),
            installed_at: Utc::now().to_rfc3339(),
        };
        write_backend_manifest(&self.app_data_dir, &manifest)?;

        // Clean up backup
        let _ = fs::remove_dir_all(&backup_dir);

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

        if let Ok(mut s) = status.lock() {
            s.state = BackendProvisionState::Downloading;
            s.downloaded_bytes = 0;
            s.total_bytes = None;
            s.error = None;
        }
        emit_status(&app, &status);

        tauri::async_runtime::spawn(async move {
            let result = update_async_inner(&app, &app_data_dir, &runtime_dir, &status).await;

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
                    eprintln!("openloop: backend update failed: {}", error.message);
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
            let _ = write_backend_manifest(&self.app_data_dir, &manifest);
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
) -> AppResult<()> {
    let client = http_client()?;
    let archive_path = runtime_dir.join(format!("acestep-{git_ref}.zip"));

    // Download with progress
    let total = download_archive_async(&client, git_ref, &archive_path, |downloaded| {
        if let Ok(mut s) = status.lock() {
            s.downloaded_bytes = downloaded;
        }
        emit_status(app, status);
    })
    .await?;

    if let Ok(mut s) = status.lock() {
        s.state = BackendProvisionState::Extracting;
        s.total_bytes = Some(total);
    }
    emit_status(app, status);

    // Extract
    extract_archive(&archive_path, runtime_dir)?;
    let _ = fs::remove_file(&archive_path);

    Ok(())
}

async fn update_async_inner(
    app: &AppHandle,
    app_data_dir: &Path,
    runtime_dir: &Path,
    status: &Arc<Mutex<BackendProvisionStatus>>,
) -> AppResult<(String, String)> {
    let (latest_tag, latest_commit) = fetch_latest_release_async().await?;

    // Download to temp dir (not inside runtime) so backup_runtime_code doesn't move it
    let client = http_client()?;
    let temp_dir = std::env::temp_dir().join("openloop-backend-update");
    fs::create_dir_all(&temp_dir).map_err(|error| {
        AppError::backend_provision_failed(format!("failed to create temp directory: {error}"))
    })?;
    let archive_path = temp_dir.join(format!("acestep-{latest_commit}.zip"));

    // Download with progress
    let total = download_archive_async(&client, &latest_commit, &archive_path, |downloaded| {
        if let Ok(mut s) = status.lock() {
            s.downloaded_bytes = downloaded;
        }
        emit_status(app, status);
    })
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
    let _ = fs::remove_file(&archive_path);

    // Update manifest
    let manifest = BackendManifest {
        installed_commit: latest_commit.clone(),
        installed_tag: Some(latest_tag.clone()),
        installed_at: Utc::now().to_rfc3339(),
    };
    write_backend_manifest(app_data_dir, &manifest)?;

    // Clean up backup
    let _ = fs::remove_dir_all(&backup_dir);

    Ok((latest_tag, latest_commit))
}

// ---------------------------------------------------------------------------
// Download functions
// ---------------------------------------------------------------------------

fn archive_url(git_ref: &str) -> String {
    // Use codeload.github.com directly to avoid the 302 redirect from github.com
    format!("https://codeload.github.com/{ACE_STEP_REPO}/zip/{git_ref}")
}

fn blocking_http_client() -> AppResult<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .user_agent(concat!("OpenLoop/", env!("CARGO_PKG_VERSION")))
        .redirect(reqwest::redirect::Policy::limited(10))
        .connect_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|error| {
            AppError::backend_provision_failed(format!("failed to build HTTP client: {error}"))
        })
}

fn http_client() -> AppResult<Client> {
    Client::builder()
        .user_agent(concat!("OpenLoop/", env!("CARGO_PKG_VERSION")))
        .redirect(reqwest::redirect::Policy::limited(10))
        .connect_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|error| {
            AppError::backend_provision_failed(format!("failed to build HTTP client: {error}"))
        })
}

fn download_archive_blocking(
    client: &reqwest::blocking::Client,
    git_ref: &str,
    target: &Path,
) -> AppResult<u64> {
    let url = archive_url(git_ref);
    let part = target.with_extension(format!("zip{PART_SUFFIX}"));

    let mut attempt: u32 = 0;
    let mut last_error: Option<AppError> = None;

    loop {
        attempt += 1;

        let response = match client.get(&url).send() {
            Ok(resp) => resp,
            Err(error) => {
                let msg = format!("failed to download backend archive: {error}");
                if attempt >= MAX_ATTEMPTS {
                    return Err(AppError::backend_provision_failed(msg));
                }
                eprintln!("openloop: {msg} (retry {attempt}/{MAX_ATTEMPTS})");
                last_error = Some(AppError::backend_provision_failed(msg));
                std::thread::sleep(retry_delay(attempt));
                continue;
            }
        };

        if !response.status().is_success() {
            let status_code = response.status();
            let msg = format!("GitHub returned HTTP {status_code} for backend archive");
            if status_code.is_server_error() && attempt < MAX_ATTEMPTS {
                eprintln!("openloop: {msg} (retry {attempt}/{MAX_ATTEMPTS})");
                last_error = Some(AppError::backend_provision_failed(msg));
                std::thread::sleep(retry_delay(attempt));
                continue;
            }
            return Err(AppError::backend_provision_failed(msg));
        }

        let bytes = response.bytes().map_err(|error| {
            AppError::backend_provision_failed(format!(
                "failed to read backend archive response: {error}"
            ))
        })?;

        if bytes.is_empty() {
            return Err(AppError::backend_provision_failed(
                "received empty response for backend archive".to_owned(),
            ));
        }

        let total = bytes.len() as u64;
        let mut writer = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&part)
            .map_err(|error| {
                AppError::backend_provision_failed(format!(
                    "failed to open archive file {}: {error}",
                    part.display()
                ))
            })?;
        writer.write_all(&bytes).map_err(|error| {
            AppError::backend_provision_failed(format!("failed to write archive file: {error}"))
        })?;
        writer.flush().ok();
        drop(writer);

        fs::rename(&part, target).map_err(|error| {
            AppError::backend_provision_failed(format!(
                "failed to move archive {} to {}: {error}",
                part.display(),
                target.display()
            ))
        })?;

        let _ = last_error;
        return Ok(total);
    }
}

async fn download_archive_async<F>(
    client: &Client,
    git_ref: &str,
    target: &Path,
    mut on_progress: F,
) -> AppResult<u64>
where
    F: FnMut(u64),
{
    let url = archive_url(git_ref);
    let part = target.with_extension(format!("zip{PART_SUFFIX}"));

    let mut attempt: u32 = 0;
    let mut last_error: Option<AppError> = None;
    let mut written: u64 = 0;

    loop {
        attempt += 1;
        on_progress(written);

        let response = match client.get(&url).send().await {
            Ok(resp) => resp,
            Err(error) => {
                let msg = format!("failed to download backend archive: {error}");
                if attempt >= MAX_ATTEMPTS {
                    return Err(AppError::backend_provision_failed(msg));
                }
                eprintln!("openloop: {msg} (retry {attempt}/{MAX_ATTEMPTS})");
                last_error = Some(AppError::backend_provision_failed(msg));
                tokio::time::sleep(retry_delay(attempt)).await;
                continue;
            }
        };

        if !response.status().is_success() {
            let status_code = response.status();
            let msg = format!("GitHub returned HTTP {status_code} for backend archive");
            if status_code.is_server_error() && attempt < MAX_ATTEMPTS {
                eprintln!("openloop: {msg} (retry {attempt}/{MAX_ATTEMPTS})");
                last_error = Some(AppError::backend_provision_failed(msg));
                tokio::time::sleep(retry_delay(attempt)).await;
                continue;
            }
            return Err(AppError::backend_provision_failed(msg));
        }

        let mut writer = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&part)
            .map_err(|error| {
                AppError::backend_provision_failed(format!(
                    "failed to open archive file {}: {error}",
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
                        return Err(AppError::backend_provision_failed(format!(
                            "failed to write to archive: {error}"
                        )));
                    }
                    written += bytes.len() as u64;
                    on_progress(written);
                }
                Err(error) => {
                    stream_failed = Some(AppError::backend_provision_failed(format!(
                        "stream error during archive download: {error}"
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
            written = fs::metadata(&part).map(|m| m.len()).unwrap_or(written);
            continue;
        }

        break;
    }

    let _ = last_error;
    fs::rename(&part, target).map_err(|error| {
        AppError::backend_provision_failed(format!(
            "failed to move archive {} to {}: {error}",
            part.display(),
            target.display()
        ))
    })?;

    on_progress(written);
    Ok(written)
}

// ---------------------------------------------------------------------------
// Zip extraction
// ---------------------------------------------------------------------------

fn extract_archive(archive_path: &Path, runtime_dir: &Path) -> AppResult<()> {
    let file = fs::File::open(archive_path).map_err(|error| {
        AppError::backend_provision_failed(format!(
            "failed to open archive {}: {error}",
            archive_path.display()
        ))
    })?;

    let mut archive = zip::ZipArchive::new(file).map_err(|error| {
        AppError::backend_provision_failed(format!("failed to read zip archive: {error}"))
    })?;

    // GitHub zips have a single top-level directory like "ACE-Step-1.5-d5d958e/"
    // We need to strip that prefix when extracting.
    let top_level_prefix = find_top_level_prefix(&mut archive)?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|error| {
            AppError::backend_provision_failed(format!("failed to read zip entry {i}: {error}"))
        })?;

        let entry_name = entry.mangled_name().to_string_lossy().to_string();

        // Strip the top-level prefix
        let relative = match top_level_prefix.strip_prefix() {
            Some(prefix) => {
                if let Some(rest) = entry_name.strip_prefix(prefix) {
                    rest.to_owned()
                } else if entry_name == prefix.trim_end_matches('/') {
                    // The directory entry itself — skip
                    continue;
                } else {
                    continue;
                }
            }
            None => entry_name.clone(),
        };

        if relative.is_empty() {
            continue;
        }

        let outpath = runtime_dir.join(&relative);

        if entry.is_dir() {
            fs::create_dir_all(&outpath).map_err(|error| {
                AppError::backend_provision_failed(format!(
                    "failed to create directory {}: {error}",
                    outpath.display()
                ))
            })?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    AppError::backend_provision_failed(format!(
                        "failed to create parent directory {}: {error}",
                        parent.display()
                    ))
                })?;
            }
            let mut outfile = fs::File::create(&outpath).map_err(|error| {
                AppError::backend_provision_failed(format!(
                    "failed to create file {}: {error}",
                    outpath.display()
                ))
            })?;
            std::io::copy(&mut entry, &mut outfile).map_err(|error| {
                AppError::backend_provision_failed(format!(
                    "failed to extract file {}: {error}",
                    outpath.display()
                ))
            })?;
        }

        // Preserve Unix permissions
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = entry.unix_mode() {
                let _ = fs::set_permissions(&outpath, fs::Permissions::from_mode(mode));
            }
        }
    }

    Ok(())
}

struct TopLevelPrefix {
    prefix: String,
}

impl TopLevelPrefix {
    fn strip_prefix(&self) -> Option<&str> {
        if self.prefix.is_empty() {
            None
        } else {
            Some(&self.prefix)
        }
    }
}

fn find_top_level_prefix(archive: &mut zip::ZipArchive<fs::File>) -> AppResult<TopLevelPrefix> {
    let mut prefixes: Vec<String> = Vec::new();

    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|error| {
            AppError::backend_provision_failed(format!("failed to read zip entry {i}: {error}"))
        })?;

        let name = entry.mangled_name().to_string_lossy().to_string();
        if let Some(slash_pos) = name.find('/') {
            let prefix = name[..slash_pos + 1].to_owned();
            if !prefixes.contains(&prefix) {
                prefixes.push(prefix);
            }
        }
    }

    if prefixes.len() == 1 {
        Ok(TopLevelPrefix {
            prefix: prefixes.into_iter().next().unwrap(),
        })
    } else {
        // No clear prefix — extract as-is
        Ok(TopLevelPrefix {
            prefix: String::new(),
        })
    }
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

pub fn read_backend_manifest(app_data_dir: &Path) -> Option<BackendManifest> {
    let path = app_data_dir.join("runtime").join(BACKEND_MANIFEST_FILENAME);
    let content = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

fn write_backend_manifest(app_data_dir: &Path, manifest: &BackendManifest) -> AppResult<()> {
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

// ---------------------------------------------------------------------------
// Migration: detect existing git clone
// ---------------------------------------------------------------------------

fn read_git_head(runtime_dir: &Path) -> Option<String> {
    let head_path = runtime_dir.join(".git").join("HEAD");
    let content = fs::read_to_string(&head_path).ok()?;
    let content = content.trim();

    // If HEAD is a ref like "ref: refs/heads/main", resolve it
    if let Some(ref_line) = content.strip_prefix("ref: ") {
        let ref_path = runtime_dir.join(".git").join(ref_line);
        let ref_content = fs::read_to_string(&ref_path).ok()?;
        return Some(ref_content.trim().to_owned());
    }

    // Direct commit SHA
    if content.len() >= 7 && content.chars().all(|c| c.is_ascii_hexdigit()) {
        return Some(content.to_owned());
    }

    None
}

// ---------------------------------------------------------------------------
// GitHub API
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
}

fn fetch_latest_release_blocking() -> AppResult<(String, String)> {
    let client = blocking_http_client()?;
    let url = format!("https://api.github.com/repos/{ACE_STEP_REPO}/releases/latest");

    let response = client.get(&url).send().map_err(|error| {
        AppError::backend_provision_failed(format!("failed to check for updates: {error}"))
    })?;

    if !response.status().is_success() {
        return Err(AppError::backend_provision_failed(format!(
            "GitHub API returned HTTP {}",
            response.status()
        )));
    }

    let release: GitHubRelease = response.json().map_err(|error| {
        AppError::backend_provision_failed(format!("failed to parse GitHub release: {error}"))
    })?;

    // Resolve tag to commit SHA via git ref API
    let ref_url = format!(
        "https://api.github.com/repos/{ACE_STEP_REPO}/git/ref/tags/{}",
        release.tag_name
    );
    let ref_response = client.get(&ref_url).send().map_err(|error| {
        AppError::backend_provision_failed(format!("failed to resolve tag: {error}"))
    })?;

    let ref_json: serde_json::Value = ref_response.json().map_err(|error| {
        AppError::backend_provision_failed(format!("failed to parse tag ref: {error}"))
    })?;

    // The SHA might be in object.sha (for lightweight tags) or need dereferencing (annotated tags)
    let commit_sha = ref_json
        .get("object")
        .and_then(|obj| {
            let sha = obj.get("sha")?.as_str()?.to_owned();
            let obj_type = obj.get("type")?.as_str()?;
            if obj_type == "commit" {
                Some(sha)
            } else {
                // For annotated tags, we'd need another API call. Use the tag SHA as fallback.
                Some(sha)
            }
        })
        .unwrap_or_else(|| PINNED_COMMIT.to_owned());

    Ok((release.tag_name, commit_sha))
}

async fn fetch_latest_release_async() -> AppResult<(String, String)> {
    let client = http_client()?;
    let url = format!("https://api.github.com/repos/{ACE_STEP_REPO}/releases/latest");

    let response = client.get(&url).send().await.map_err(|error| {
        AppError::backend_provision_failed(format!("failed to check for updates: {error}"))
    })?;

    if !response.status().is_success() {
        return Err(AppError::backend_provision_failed(format!(
            "GitHub API returned HTTP {}",
            response.status()
        )));
    }

    let release: GitHubRelease = response.json().await.map_err(|error| {
        AppError::backend_provision_failed(format!("failed to parse GitHub release: {error}"))
    })?;

    let ref_url = format!(
        "https://api.github.com/repos/{ACE_STEP_REPO}/git/ref/tags/{}",
        release.tag_name
    );
    let ref_response = client.get(&ref_url).send().await.map_err(|error| {
        AppError::backend_provision_failed(format!("failed to resolve tag: {error}"))
    })?;

    let ref_json: serde_json::Value = ref_response.json().await.map_err(|error| {
        AppError::backend_provision_failed(format!("failed to parse tag ref: {error}"))
    })?;

    let commit_sha = ref_json
        .get("object")
        .and_then(|obj| {
            let sha = obj.get("sha")?.as_str()?.to_owned();
            let _obj_type = obj.get("type")?.as_str()?;
            Some(sha)
        })
        .unwrap_or_else(|| PINNED_COMMIT.to_owned());

    Ok((release.tag_name, commit_sha))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn backup_runtime_code(runtime_dir: &Path, backup_dir: &Path) -> AppResult<()> {
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

fn emit_status(app: &AppHandle, status: &Arc<Mutex<BackendProvisionStatus>>) {
    if let Ok(s) = status.lock() {
        let _ = app.emit(BACKEND_PROVISION_EVENT, s.clone());
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_provisioner_with_no_manifest_reports_not_installed() {
        let temp = tempfile::tempdir().expect("temp dir");
        let provisioner = BackendProvisioner::new(temp.path().to_path_buf());
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

        let provisioner = BackendProvisioner::new(temp.path().to_path_buf());
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
        let _provisioner = BackendProvisioner::new(temp.path().to_path_buf());

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
}
