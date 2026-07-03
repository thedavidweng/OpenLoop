use std::{fs, io::Write, path::PathBuf, process::Command};

use uuid::Uuid;

use crate::{
    cli::{cli_error, human_output},
    models::errors::{AppError, AppResult},
    services::history::{self, HistoryService},
};

use super::AppState;
use crate::cli::spec::FilesCommand;

pub fn execute(state: &AppState, json: bool, command: FilesCommand) -> AppResult<()> {
    match command {
        FilesCommand::Reveal { path } => cmd_reveal(state, json, &path),
        FilesCommand::Copy { src, dst } => cmd_copy(state, json, &src, &dst),
        FilesCommand::Exists { path } => cmd_exists(state, json, &path),
        FilesCommand::ReadAudio { id, output } => cmd_read_audio(state, json, &id, output),
        FilesCommand::Waveform { id } => cmd_waveform(state, &id),
        FilesCommand::Unlink { id, keep_record } => cmd_unlink(state, json, &id, keep_record),
    }
}

fn cmd_reveal(_state: &AppState, json: bool, path: &str) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    {
        let status = Command::new("open")
            .arg("-R")
            .arg(path)
            .status()
            .map_err(|e| cli_error(e.to_string()))?;

        if !status.success() {
            return Err(cli_error(format!("open -R exited with status {status}")));
        }
    }

    if json {
        super::json_output(&format!(r#"{{"revealed":"{path}"}}"#));
    } else {
        #[cfg(target_os = "macos")]
        human_output(&format!("✓ Revealed: {path}"));
        #[cfg(not(target_os = "macos"))]
        human_output(&format!("Path: {path}"));
    }

    Ok(())
}

fn cmd_copy(_state: &AppState, json: bool, src: &str, dst: &str) -> AppResult<()> {
    let src_path = PathBuf::from(src);
    let dst_path = PathBuf::from(dst);
    let target_path = if dst_path.is_dir() {
        let filename = src_path
            .file_name()
            .ok_or_else(|| cli_error("source path has no filename"))?;
        dst_path.join(filename)
    } else {
        dst_path
    };

    fs::copy(src, &target_path).map_err(|e| cli_error(e.to_string()))?;

    let display = target_path.display().to_string();
    if json {
        super::json_output(&format!(r#"{{"copied":"{display}"}}"#));
    } else {
        human_output(&format!("✓ Copied to: {display}"));
    }

    Ok(())
}

fn cmd_exists(_state: &AppState, json: bool, path: &str) -> AppResult<()> {
    let exists = PathBuf::from(path).exists();

    if json {
        let value = serde_json::json!({ "exists": exists, "path": path });
        super::json_output(
            &serde_json::to_string_pretty(&value).map_err(|e| cli_error(e.to_string()))?,
        );
        Ok(())
    } else if exists {
        human_output(&format!("✓ File exists: {path}"));
        Ok(())
    } else {
        Err(AppError::new(
            "FILE_NOT_FOUND",
            format!("File not found: {path}"),
            None,
            false,
        ))
    }
}

fn cmd_read_audio(state: &AppState, json: bool, id: &str, output: Option<String>) -> AppResult<()> {
    let record = history::resolve_by_prefix(&state.db, id)?;
    let path = record
        .output_path
        .as_ref()
        .map(std::path::PathBuf::from)
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

    match output.as_deref() {
        Some("-") => {
            let stdout = std::io::stdout();
            let mut handle = stdout.lock();
            handle
                .write_all(&bytes)
                .map_err(|e| cli_error(e.to_string()))?;
            Ok(())
        }
        Some(custom_path) => {
            fs::write(custom_path, &bytes).map_err(|e| cli_error(e.to_string()))?;
            if json {
                super::json_output(&format!(r#"{{"path":"{custom_path}"}}"#));
            } else {
                human_output(&format!("✓ Wrote audio to: {custom_path}"));
            }
            Ok(())
        }
        None => {
            let filename = format!("openloop_audio_{}.wav", Uuid::new_v4());
            let tmp_path = std::env::temp_dir().join(filename);
            fs::write(&tmp_path, &bytes).map_err(|e| cli_error(e.to_string()))?;
            let display = tmp_path.display().to_string();
            if json {
                super::json_output(&format!(r#"{{"path":"{display}"}}"#));
            } else {
                human_output(&format!("✓ Wrote audio to: {display}"));
            }
            Ok(())
        }
    }
}

fn cmd_waveform(state: &AppState, id: &str) -> AppResult<()> {
    let history = HistoryService::new(state.db.clone());
    let waveform = history.read_generation_waveform(id)?;

    let output = serde_json::to_string_pretty(&waveform).map_err(|e| cli_error(e.to_string()))?;
    super::json_output(&output);

    Ok(())
}

fn cmd_unlink(state: &AppState, json: bool, id_arg: &str, keep_record: bool) -> AppResult<()> {
    let records = state.db.list_generations(None)?;

    let record = records
        .iter()
        .find(|r| r.id.starts_with(id_arg))
        .ok_or_else(|| cli_error(format!("no generation record matches '{id_arg}'")))?;

    let conflicting = records.iter().filter(|r| r.id.starts_with(id_arg)).count();
    if conflicting > 1 {
        return Err(cli_error(format!(
            "ambiguous prefix '{id_arg}' matches {conflicting} records. Use a longer prefix.",
        )));
    }

    if keep_record {
        // Only delete the file, keep the DB record
        if let Some(path_str) = &record.output_path {
            let path = PathBuf::from(path_str);
            if path.is_file() {
                fs::remove_file(&path).map_err(|e| cli_error(e.to_string()))?;
            }
        }

        if json {
            super::json_output(&format!(r#"{{"unlinked":"{}"}}"#, record.id));
        } else {
            human_output(&format!(
                "✓ Deleted file for: {}",
                &record.id[..8.min(record.id.len())]
            ));
        }
    } else {
        // Delete both file and record
        HistoryService::new(state.db.clone()).delete_generation_file_and_record(&record.id)?;

        if json {
            super::json_output(&format!(r#"{{"unlinked":"{}"}}"#, record.id));
        } else {
            human_output(&format!(
                "✓ Unlinked: {} ({prompt})",
                &record.id[..8.min(record.id.len())],
                prompt = record.prompt
            ));
        }
    }

    Ok(())
}
