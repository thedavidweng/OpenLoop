use std::{
    fs::{self, OpenOptions},
    io::Write as _,
    path::Path,
    sync::Arc,
    time::Duration,
};

use futures_util::StreamExt;
use reqwest::Client;

use crate::models::errors::{AppError, AppResult};
use crate::services::network_log::NetworkActivityLog;

use super::types::{ACE_STEP_REPO, MAX_ATTEMPTS, PART_SUFFIX};

pub fn retry_delay(attempt: u32) -> Duration {
    Duration::from_secs(2u64.pow(attempt.min(5)))
}

fn archive_url(git_ref: &str) -> String {
    // Use codeload.github.com directly to avoid the 302 redirect from github.com
    format!("https://codeload.github.com/{ACE_STEP_REPO}/zip/{git_ref}")
}

pub fn blocking_http_client() -> AppResult<reqwest::blocking::Client> {
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

pub fn http_client() -> AppResult<Client> {
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

pub fn flush_archive_error(error: impl std::fmt::Display) -> AppError {
    AppError::backend_provision_failed(format!("failed to flush archive file: {error}"))
}

pub fn download_archive_blocking(
    client: &reqwest::blocking::Client,
    git_ref: &str,
    target: &Path,
    network_log: &NetworkActivityLog,
) -> AppResult<u64> {
    let url = archive_url(git_ref);
    let part = target.with_extension(format!("zip{PART_SUFFIX}"));

    let mut attempt: u32 = 0;
    let mut last_error: Option<AppError> = None;

    loop {
        attempt += 1;

        let response = match client.get(&url).send() {
            Ok(resp) => {
                network_log.record(&url, "GET", resp.status().as_u16());
                resp
            }
            Err(error) => {
                let msg = format!("failed to download backend archive: {error}");
                if attempt >= MAX_ATTEMPTS {
                    return Err(AppError::backend_provision_failed(msg));
                }
                tracing::warn!("{msg} (retry {attempt}/{MAX_ATTEMPTS})");
                last_error = Some(AppError::backend_provision_failed(msg));
                std::thread::sleep(retry_delay(attempt));
                continue;
            }
        };

        if !response.status().is_success() {
            let status_code = response.status();
            let msg = format!("GitHub returned HTTP {status_code} for backend archive");
            if status_code.is_server_error() && attempt < MAX_ATTEMPTS {
                tracing::warn!("{msg} (retry {attempt}/{MAX_ATTEMPTS})");
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
        writer.flush().map_err(flush_archive_error)?;
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

pub async fn download_archive_async<F>(
    client: &Client,
    git_ref: &str,
    target: &Path,
    network_log: Arc<NetworkActivityLog>,
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
            Ok(resp) => {
                network_log.record(&url, "GET", resp.status().as_u16());
                resp
            }
            Err(error) => {
                let msg = format!("failed to download backend archive: {error}");
                if attempt >= MAX_ATTEMPTS {
                    return Err(AppError::backend_provision_failed(msg));
                }
                tracing::warn!("{msg} (retry {attempt}/{MAX_ATTEMPTS})");
                last_error = Some(AppError::backend_provision_failed(msg));
                tokio::time::sleep(retry_delay(attempt)).await;
                continue;
            }
        };

        if !response.status().is_success() {
            let status_code = response.status();
            let msg = format!("GitHub returned HTTP {status_code} for backend archive");
            if status_code.is_server_error() && attempt < MAX_ATTEMPTS {
                tracing::warn!("{msg} (retry {attempt}/{MAX_ATTEMPTS})");
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

        // Reset progress: the part file is truncated on each retry, so the
        // previous attempt's partial byte count no longer applies.
        written = 0;

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

        writer.flush().map_err(flush_archive_error)?;
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
