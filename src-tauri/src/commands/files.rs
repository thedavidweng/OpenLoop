use std::{fs, path::PathBuf, process::Command};

use tauri::{command, ipc::Response, State};

use crate::{
    models::errors::{AppError, AppResult},
    models::generation::GenerationWaveform,
    services::history::{self, HistoryService},
    AppState,
};

/// Export multiple generation audio files to a folder.
#[command]
pub fn export_generations_to_folder(
    state: State<'_, AppState>,
    ids: Vec<String>,
    destination: String,
) -> AppResult<Vec<String>> {
    let dest = PathBuf::from(&destination);
    if !dest.is_dir() {
        return Err(AppError::output_write_failed(format!(
            "destination is not a directory: {}",
            destination
        )));
    }
    let mut copied = Vec::with_capacity(ids.len());
    for id in ids {
        let record = state
            .db
            .get_generation(&id)?
            .ok_or_else(|| AppError::not_found("Generation record", id.clone()))?;
        let src = record
            .output_path
            .as_ref()
            .and_then(|p| PathBuf::from(p).file_name().map(PathBuf::from))
            .ok_or_else(|| {
                AppError::output_write_failed(format!("generation {id} has no output file"))
            })?;
        let source = PathBuf::from(record.output_path.as_ref().unwrap());
        let target = dest.join(&src);
        fs::copy(&source, &target)
            .map_err(|error| AppError::output_write_failed(error.to_string()))?;
        copied.push(target.display().to_string());
    }
    Ok(copied)
}

/// Prepare a temporary hard-link path for drag-out to DAW/Finder.
#[command]
pub fn prepare_drag_payload(state: State<'_, AppState>, id: String) -> AppResult<String> {
    let record = state
        .db
        .get_generation(&id)?
        .ok_or_else(|| AppError::not_found("Generation record", id.clone()))?;
    let source = PathBuf::from(record.output_path.ok_or_else(|| {
        AppError::output_write_failed(format!("generation {id} has no output file"))
    })?);
    if !source.is_file() {
        return Err(AppError::not_found(
            "Generation audio",
            source.display().to_string(),
        ));
    }
    let temp_dir = std::env::temp_dir().join("openloop_drag");
    fs::create_dir_all(&temp_dir)
        .map_err(|error| AppError::output_write_failed(error.to_string()))?;
    let file_name = source
        .file_name()
        .ok_or_else(|| AppError::output_write_failed("source file has no filename"))?;
    let temp_path = temp_dir.join(file_name);
    // Remove existing temp file if present
    let _ = fs::remove_file(&temp_path);
    // Try hard link first, fall back to copy
    if let Err(_) = fs::hard_link(&source, &temp_path) {
        fs::copy(&source, &temp_path)
            .map_err(|error| AppError::output_write_failed(error.to_string()))?;
    }
    Ok(temp_path.display().to_string())
}

#[command]
pub fn reveal_in_finder(path: String) -> AppResult<()> {
    let status = Command::new("open")
        .arg("-R")
        .arg(&path)
        .status()
        .map_err(|error| AppError::output_write_failed(error.to_string()))?;

    if status.success() {
        return Ok(());
    }

    Err(AppError::output_write_failed(format!(
        "open -R exited with status {status}"
    )))
}

#[command]
pub fn copy_audio_to(path: String, destination: String) -> AppResult<String> {
    let source = PathBuf::from(&path);
    let destination_path = PathBuf::from(&destination);
    let target_path = if destination_path.is_dir() {
        destination_path.join(
            source
                .file_name()
                .ok_or_else(|| AppError::output_write_failed("source file has no filename"))?,
        )
    } else {
        destination_path
    };

    fs::copy(&source, &target_path)
        .map_err(|error| AppError::output_write_failed(error.to_string()))?;

    Ok(target_path.display().to_string())
}

#[command]
pub fn file_exists(path: String) -> AppResult<bool> {
    Ok(PathBuf::from(path).exists())
}

#[command]
pub fn read_generation_audio(state: State<'_, AppState>, id: String) -> AppResult<Response> {
    let record = history::resolve_by_prefix(&state.db, &id)?;
    let path = record
        .output_path
        .as_ref()
        .map(PathBuf::from)
        .ok_or_else(|| {
            AppError::not_found(
                "Generation audio",
                format!("record {id} has no output path"),
            )
        })?;
    if !path.is_file() {
        return Err(AppError::not_found(
            "Generation audio",
            path.display().to_string(),
        ));
    }
    let bytes = fs::read(&path).map_err(|error| AppError::output_read_failed(error.to_string()))?;
    Ok(Response::new(bytes))
}

#[command]
pub fn read_generation_waveform(
    state: State<'_, AppState>,
    id: String,
) -> AppResult<GenerationWaveform> {
    HistoryService::new(state.db.clone()).read_generation_waveform(&id)
}

#[command]
pub fn delete_generation_file(path: String) -> AppResult<()> {
    fs::remove_file(path).map_err(|error| AppError::output_write_failed(error.to_string()))
}

#[command]
pub fn delete_generation_file_and_record(state: State<'_, AppState>, id: String) -> AppResult<()> {
    HistoryService::new(state.db.clone()).delete_generation_file_and_record(&id)
}
