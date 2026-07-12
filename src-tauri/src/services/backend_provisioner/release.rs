use std::sync::Arc;

use serde::Deserialize;

use crate::models::errors::{AppError, AppResult};
use crate::services::network_log::NetworkActivityLog;

use super::download::{blocking_http_client, http_client};
use super::types::{ACE_STEP_REPO, PINNED_COMMIT};

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
}

pub fn fetch_latest_release_blocking(
    network_log: &NetworkActivityLog,
) -> AppResult<(String, String)> {
    let client = blocking_http_client()?;
    let url = format!("https://api.github.com/repos/{ACE_STEP_REPO}/releases/latest");

    let response = client.get(&url).send().map_err(|error| {
        AppError::backend_provision_failed(format!("failed to check for updates: {error}"))
    })?;
    network_log.record(&url, "GET", response.status().as_u16());

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
    network_log.record(&ref_url, "GET", ref_response.status().as_u16());

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

pub async fn fetch_latest_release_async(
    network_log: Arc<NetworkActivityLog>,
) -> AppResult<(String, String)> {
    let client = http_client()?;
    let url = format!("https://api.github.com/repos/{ACE_STEP_REPO}/releases/latest");

    let response = client.get(&url).send().await.map_err(|error| {
        AppError::backend_provision_failed(format!("failed to check for updates: {error}"))
    })?;
    network_log.record(&url, "GET", response.status().as_u16());

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
    network_log.record(&ref_url, "GET", ref_response.status().as_u16());

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
