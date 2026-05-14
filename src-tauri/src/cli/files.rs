use std::{fs, io::Write, path::PathBuf, process::Command};

use uuid::Uuid;

use crate::{
    cli::{cli_error, human_output},
    models::errors::{AppError, AppResult},
    services::history::HistoryService,
};

use super::AppState;

pub fn execute(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = args.contains(&"--json".to_owned());
    let help = args.contains(&"--help".to_owned()) || args.contains(&"-h".to_owned());

    if help {
        print_help();
        return Ok(());
    }

    // Find the subcommand: first non-flag argument after "files" (args[0])
    let sub_pos = args.iter().skip(1).position(|a| !a.starts_with('-'));
    let subcommand = sub_pos.map_or("help", |i| args[i + 1].as_str());
    let sub_args = if let Some(i) = sub_pos {
        &args[i + 2..]
    } else {
        &[]
    };

    match subcommand {
        "reveal" => cmd_reveal(state, sub_args, json),
        "copy" => cmd_copy(state, sub_args, json),
        "exists" => cmd_exists(state, sub_args, json),
        "read-audio" => cmd_read_audio(state, sub_args, json),
        "waveform" => cmd_waveform(state, sub_args, json),
        "unlink" => cmd_unlink(state, sub_args, json),
        "help" | "--help" | "-h" => {
            print_help();
            Ok(())
        }
        _ => Err(cli_error(format!(
            "unknown files subcommand '{subcommand}'. Use 'openloop files --help' to see available subcommands.",
        ))),
    }
}

fn cmd_reveal(_state: &AppState, args: &[String], json: bool) -> AppResult<()> {
    let path = args
        .iter()
        .find(|a| !a.starts_with('-'))
        .ok_or_else(|| cli_error("path is required. Usage: openloop files reveal <path>"))?;

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

fn cmd_copy(_state: &AppState, args: &[String], json: bool) -> AppResult<()> {
    let positional: Vec<&str> = args
        .iter()
        .filter(|a| !a.starts_with('-'))
        .map(String::as_str)
        .collect();
    let src = positional
        .first()
        .ok_or_else(|| cli_error("src is required. Usage: openloop files copy <src> <dst>"))?;
    let dst = positional
        .get(1)
        .ok_or_else(|| cli_error("dst is required. Usage: openloop files copy <src> <dst>"))?;

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

fn cmd_exists(_state: &AppState, args: &[String], json: bool) -> AppResult<()> {
    let path = args
        .iter()
        .find(|a| !a.starts_with('-'))
        .ok_or_else(|| cli_error("path is required. Usage: openloop files exists <path>"))?;

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

fn cmd_read_audio(state: &AppState, args: &[String], json: bool) -> AppResult<()> {
    let id = args
        .iter()
        .find(|a| !a.starts_with('-'))
        .ok_or_else(|| cli_error("id is required. Usage: openloop files read-audio <id>"))?;

    let history = HistoryService::new(state.db.clone());
    let bytes = history.read_generation_audio_bytes(id)?;

    // Parse --output flag
    let output_to_stdout = args.windows(2).any(|w| w[0] == "--output" && w[1] == "-");
    let custom_path = args
        .windows(2)
        .find(|w| w[0] == "--output" && w[1] != "-")
        .map(|w| w[1].as_str());

    if output_to_stdout {
        let stdout = std::io::stdout();
        let mut handle = stdout.lock();
        handle
            .write_all(&bytes)
            .map_err(|e| cli_error(e.to_string()))?;
        Ok(())
    } else if let Some(path) = custom_path {
        fs::write(path, &bytes).map_err(|e| cli_error(e.to_string()))?;
        if json {
            super::json_output(&format!(r#"{{"path":"{path}"}}"#));
        } else {
            human_output(&format!("✓ Wrote audio to: {path}"));
        }
        Ok(())
    } else {
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

fn cmd_waveform(state: &AppState, args: &[String], _json: bool) -> AppResult<()> {
    let id = args
        .iter()
        .find(|a| !a.starts_with('-'))
        .ok_or_else(|| cli_error("id is required. Usage: openloop files waveform <id>"))?;

    let history = HistoryService::new(state.db.clone());
    let waveform = history.read_generation_waveform(id)?;

    let output = serde_json::to_string_pretty(&waveform).map_err(|e| cli_error(e.to_string()))?;
    super::json_output(&output);

    Ok(())
}

fn cmd_unlink(state: &AppState, args: &[String], json: bool) -> AppResult<()> {
    let id_arg = args
        .iter()
        .find(|a| !a.starts_with('-'))
        .ok_or_else(|| cli_error("id is required. Usage: openloop files unlink <id>"))?;

    let keep_record = args.contains(&"--keep-record".to_owned());
    let history = HistoryService::new(state.db.clone());
    let records = history.list_generations(None)?;

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
        history.delete_generation_file_and_record(&record.id)?;

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

fn print_help() {
    human_output(
        "\
openloop files — File and output management

Usage:
  openloop files <subcommand> [args] [flags]

Subcommands:
  reveal <path>       Open Finder/Explorer at the file location
  copy <src> <dst>    Copy a file
  exists <path>       Check if a file exists
  read-audio <id>     Read audio bytes for a generation record
  waveform <id>       Read waveform peaks for a generation record
  unlink <id>         Delete a generation record and its file

Flags:
  --json              JSON output (supported by most subcommands)
  --help              Show help

Use 'openloop files <subcommand> --help' for subcommand-specific help.",
    );
}
