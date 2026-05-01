use std::{fs, path::PathBuf, process::Command};

use tauri::{command, ipc::Response, State};

use crate::{
    models::errors::{AppError, AppResult},
    models::generation::GenerationWaveform,
    services::history::HistoryService,
    AppState,
};

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
    HistoryService::new(state.db.clone()).read_generation_audio_response(&id)
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
