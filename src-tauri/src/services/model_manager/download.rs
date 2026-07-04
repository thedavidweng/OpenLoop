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

use futures_util::StreamExt;
use reqwest::redirect::Policy;
use reqwest::Client;
use sha2::Digest;
use tauri::{AppHandle, Emitter};

use crate::{
    models::{
        errors::{AppError, AppResult},
        settings::AppSettings,
    },
    services::{model_bootstrap::checkpoints_dir_for, network_log::NetworkActivityLog},
};

use super::{
    manifest::{read_manifest, variant_key},
    mirror::resolve_download_url,
    specs::pack_for_descriptor,
    types::{
        AceModelDescriptor, ModelDownloadState, ModelFileSpec, ModelStatusSnapshot,
        HF_RESOLVE_BASE, MODEL_DOWNLOAD_EVENT, PART_SUFFIX, PROGRESS_EVENT_INTERVAL,
    },
};

/// Path of the in-progress download part file for a given target.
pub fn part_path(target: &Path) -> PathBuf {
    let mut name = target
        .file_name()
        .map(|n| n.to_os_string())
        .unwrap_or_default();
    name.push(PART_SUFFIX);
    target.with_file_name(name)
}

/// Backoff between download retry attempts.
pub fn retry_delay(attempt: u32) -> Duration {
    let shift = attempt.saturating_sub(1).min(3);
    let secs: u64 = 1u64 << shift;
    Duration::from_secs(secs.min(8))
}

// ---------------------------------------------------------------------------
// HTTP clients
// ---------------------------------------------------------------------------

pub fn http_client() -> AppResult<Client> {
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

pub fn blocking_http_client() -> AppResult<reqwest::blocking::Client> {
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

// ---------------------------------------------------------------------------
// Inspection + snapshot builders
// ---------------------------------------------------------------------------

/// A spec whose file is synced at runtime from the bundled backend code rather
/// than downloaded as a model asset (the small `.py`/`.json` glue files).
pub fn is_runtime_synced_model_code(spec: &ModelFileSpec) -> bool {
    spec.local_path.ends_with(".py")
}

/// Look up the manifest entry for a pack, tolerating packs that share weights
/// with another variant (Lite/Turbo share the same DiT weights).
pub fn installed_manifest_for_pack<'a>(
    manifest: &'a super::types::ModelManifest,
    descriptor: &AceModelDescriptor,
) -> Option<&'a super::types::InstalledModelManifest> {
    manifest
        .installed
        .get(&variant_key(descriptor.variant))
        .or_else(|| {
            super::ACE_MODEL_DESCRIPTORS
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

/// Inspect the filesystem + manifest to build the current status snapshot for a pack.
pub fn inspect_descriptor_for(
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

pub fn downloading_snapshot(
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

pub fn failed_snapshot_for(
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

/// Emit a snapshot to both the in-memory status store and the frontend event.
pub fn publish_snapshot(
    app: &AppHandle,
    status: &Arc<Mutex<Vec<ModelStatusSnapshot>>>,
    snapshot: ModelStatusSnapshot,
) {
    if let Ok(mut guard) = status.lock() {
        upsert_snapshot(&mut guard, snapshot.clone());
    }
    let _ = app.emit(MODEL_DOWNLOAD_EVENT, snapshot);
}

/// Insert or replace a snapshot keyed by variant.
pub fn upsert_snapshot(snapshots: &mut Vec<ModelStatusSnapshot>, snapshot: ModelStatusSnapshot) {
    if let Some(existing) = snapshots
        .iter_mut()
        .find(|current| current.variant == snapshot.variant)
    {
        *existing = snapshot;
    } else {
        snapshots.push(snapshot);
    }
}

// ---------------------------------------------------------------------------
// SHA256 integrity verification
// ---------------------------------------------------------------------------

pub fn verify_sha256(path: &Path, expected: &str) -> AppResult<()> {
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

pub fn hex_lower(bytes: impl AsRef<[u8]>) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";

    let bytes = bytes.as_ref();
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

// ---------------------------------------------------------------------------
// Async download path (GUI)
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_arguments)]
pub async fn download_pack(
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

    let mirrors = if settings.model_mirrors.is_empty() {
        vec![HF_RESOLVE_BASE.to_owned()]
    } else {
        settings.model_mirrors.clone()
    };
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

        download_single_file(
            &client,
            spec,
            &target,
            &mirrors,
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
    mirrors: &[String],
    network_log: &NetworkActivityLog,
    mut on_progress: F,
) -> AppResult<()>
where
    F: FnMut(u64),
{
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
    let mut mirror_index = 0;
    let mut last_error: Option<AppError> = None;
    let mut written = resume_from;

    'mirrors: while mirror_index < mirrors.len() {
        let url = resolve_download_url(spec, &mirrors[mirror_index]);
        let mut attempt: u32 = 0;

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
                    last_error = Some(AppError::model_download_failed(message.clone()));
                    if attempt >= MAX_ATTEMPTS {
                        if mirror_index + 1 < mirrors.len() {
                            eprintln!("openloop: {} (trying next mirror)", message);
                            mirror_index += 1;
                            continue 'mirrors;
                        }
                        return Err(AppError::model_download_failed(message));
                    }
                    eprintln!("openloop: {} (retry {attempt}/{MAX_ATTEMPTS})", message);
                    tokio::time::sleep(retry_delay(attempt)).await;
                    written = fs::metadata(&part).map(|m| m.len()).unwrap_or(written);
                    continue;
                }
            };

            if !response.status().is_success() {
                let status_code = response.status();
                let message = format!("HTTP {status_code} for {}/{}", spec.repo, spec.remote_path);
                last_error = Some(AppError::model_download_failed(message.clone()));
                if status_code.is_client_error() && mirror_index + 1 < mirrors.len() {
                    mirror_index += 1;
                    continue 'mirrors;
                }
                if attempt >= MAX_ATTEMPTS {
                    if mirror_index + 1 < mirrors.len() {
                        eprintln!("openloop: {} (trying next mirror)", message);
                        mirror_index += 1;
                        continue 'mirrors;
                    }
                    return Err(AppError::model_download_failed(message));
                }
                if status_code.is_server_error() {
                    written = fs::metadata(&part).map(|m| m.len()).unwrap_or(written);
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
                    if mirror_index + 1 < mirrors.len() {
                        eprintln!("openloop: {} (trying next mirror)", error.message);
                        last_error = Some(error);
                        mirror_index += 1;
                        written = fs::metadata(&part).map(|m| m.len()).unwrap_or(written);
                        continue 'mirrors;
                    }
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

            if written < spec.size {
                let message = format!(
                    "incomplete download for {}/{} ({} / {} bytes)",
                    spec.repo, spec.remote_path, written, spec.size
                );
                if attempt >= MAX_ATTEMPTS {
                    if mirror_index + 1 < mirrors.len() {
                        eprintln!("openloop: {} (trying next mirror)", message);
                        last_error = Some(AppError::model_download_failed(message));
                        mirror_index += 1;
                        written = fs::metadata(&part).map(|m| m.len()).unwrap_or(written);
                        continue 'mirrors;
                    }
                    return Err(AppError::model_download_failed(message));
                }
                eprintln!("openloop: {} (retry {attempt}/{MAX_ATTEMPTS})", message);
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
                if mirror_index + 1 < mirrors.len() {
                    eprintln!("openloop: {} (trying next mirror)", error.message);
                    mirror_index += 1;
                    written = 0;
                    continue 'mirrors;
                }
                return Err(error);
            }
        }

        on_progress(spec.size);
        return Ok(());
    }

    Err(last_error
        .unwrap_or_else(|| AppError::model_download_failed("all mirrors exhausted".to_owned())))
}

pub fn download_single_file_blocking(
    client: &reqwest::blocking::Client,
    spec: &ModelFileSpec,
    target: &Path,
    mirrors: &[String],
    network_log: &NetworkActivityLog,
) -> AppResult<()> {
    use std::io::Read;

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
    let mut mirror_index = 0;
    let mut written = resume_from;

    'mirrors: while mirror_index < mirrors.len() {
        let url = resolve_download_url(spec, &mirrors[mirror_index]);
        let mut attempt: u32 = 0;

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
                        if mirror_index + 1 < mirrors.len() {
                            eprintln!("openloop: {} (trying next mirror)", message);
                            mirror_index += 1;
                            continue 'mirrors;
                        }
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
                let message = format!("HTTP {status_code} for {}/{}", spec.repo, spec.remote_path);
                if status_code.is_client_error() && mirror_index + 1 < mirrors.len() {
                    mirror_index += 1;
                    continue 'mirrors;
                }
                if attempt >= MAX_ATTEMPTS {
                    if mirror_index + 1 < mirrors.len() {
                        eprintln!("openloop: {} (trying next mirror)", message);
                        mirror_index += 1;
                        continue 'mirrors;
                    }
                    return Err(AppError::model_download_failed(message));
                }
                if status_code.is_server_error() {
                    written = fs::metadata(&part).map(|m| m.len()).unwrap_or(written);
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
                        let message = format!(
                            "stream error for {}/{}: {error}",
                            spec.repo, spec.remote_path
                        );
                        if attempt >= MAX_ATTEMPTS {
                            if mirror_index + 1 < mirrors.len() {
                                eprintln!("openloop: {} (trying next mirror)", message);
                                mirror_index += 1;
                                written = fs::metadata(&part).map(|m| m.len()).unwrap_or(written);
                                continue 'mirrors;
                            }
                            return Err(AppError::model_download_failed(message));
                        }
                        eprintln!("openloop: {} (retry {attempt}/{MAX_ATTEMPTS})", message);
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
                    if mirror_index + 1 < mirrors.len() {
                        mirror_index += 1;
                        written = fs::metadata(&part).map(|m| m.len()).unwrap_or(written);
                        continue 'mirrors;
                    }
                    return Err(AppError::model_download_failed(message));
                }
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
                if mirror_index + 1 < mirrors.len() {
                    eprintln!("openloop: {} (trying next mirror)", error.message);
                    mirror_index += 1;
                    written = 0;
                    continue 'mirrors;
                }
                return Err(error);
            }
        }

        return Ok(());
    }

    Err(AppError::model_download_failed(
        "all mirrors exhausted".to_owned(),
    ))
}
