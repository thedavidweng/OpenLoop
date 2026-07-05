use crate::{
    cli::{cli_error, human_output, json_output, spec::ProfileCommand},
    models::{
        errors::{AppError, AppResult},
        profile::CreateProfileRequest,
    },
};

use super::AppState;

pub fn execute(state: &AppState, json: bool, command: ProfileCommand) -> AppResult<()> {
    match command {
        ProfileCommand::List => cmd_list(state, json),
        ProfileCommand::Create {
            name,
            model,
            duration,
            format,
            thinking,
            steps,
            guidance,
            bpm,
            key,
            time_signature,
            language,
            lm_backend,
        } => cmd_create(
            state, json, &name, model, duration, format, thinking, steps, guidance, bpm, key,
            time_signature, language, lm_backend,
        ),
        ProfileCommand::Rename { id, name } => cmd_rename(state, json, &id, &name),
        ProfileCommand::Delete { id, yes } => cmd_delete(state, json, &id, yes),
    }
}

fn cmd_list(state: &AppState, json: bool) -> AppResult<()> {
    let profiles = state.db.list_profiles()?;

    if json {
        let output =
            serde_json::to_string_pretty(&profiles).map_err(|e| cli_error(e.to_string()))?;
        json_output(&output);
    } else {
        if profiles.is_empty() {
            human_output("No profiles.");
            return Ok(());
        }
        println!("{:<12} {:<20} {:<8} {:<8} {:<8}", "ID", "Name", "Model", "Steps", "Format");
        println!("{}", "-".repeat(60));
        for profile in &profiles {
            let short_id = &profile.id[..8.min(profile.id.len())];
            let name = if profile.name.len() > 18 {
                format!("{}…", &profile.name[..17])
            } else {
                profile.name.clone()
            };
            println!(
                "{:<12} {:<20} {:<8} {:<8} {:<8}",
                short_id,
                name,
                profile.model_variant.as_deref().unwrap_or("-"),
                profile
                    .inference_steps
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "-".to_string()),
                profile.audio_format.as_deref().unwrap_or("-"),
            );
        }
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn cmd_create(
    state: &AppState,
    json: bool,
    name: &str,
    model: Option<String>,
    duration: Option<f64>,
    format: Option<String>,
    thinking: Option<String>,
    steps: Option<i64>,
    guidance: Option<f64>,
    bpm: Option<i64>,
    key: Option<String>,
    time_signature: Option<String>,
    language: Option<String>,
    lm_backend: Option<String>,
) -> AppResult<()> {
    let thinking_bool = match thinking.as_deref() {
        Some("on") | Some("true") => Some(true),
        Some("off") | Some("false") => Some(false),
        Some(other) => {
            return Err(AppError::validation_failed(format!(
                "Invalid thinking value '{other}' (expected on/off)"
            )));
        }
        None => None,
    };

    let request = CreateProfileRequest {
        name: name.to_string(),
        model_variant: model,
        duration_seconds: duration,
        audio_format: format,
        thinking: thinking_bool,
        inference_steps: steps,
        guidance_scale: guidance,
        bpm,
        key_scale: key,
        time_signature,
        vocal_language: language,
        lm_backend,
    };

    let profile = state.db.create_profile(&request)?;
    if json {
        let output =
            serde_json::to_string_pretty(&profile).map_err(|e| cli_error(e.to_string()))?;
        json_output(&output);
    } else {
        human_output(&format!(
            "Created profile '{}' (id: {})",
            profile.name, profile.id
        ));
    }
    Ok(())
}

fn cmd_rename(state: &AppState, json: bool, id: &str, name: &str) -> AppResult<()> {
    let resolved = resolve_profile_by_prefix(&state.db, id)?;
    let profile = state.db.rename_profile(&resolved, name)?;
    if json {
        let output =
            serde_json::to_string_pretty(&profile).map_err(|e| cli_error(e.to_string()))?;
        json_output(&output);
    } else {
        human_output(&format!("Renamed profile {} to '{}'", resolved, name));
    }
    Ok(())
}

fn cmd_delete(state: &AppState, json: bool, id: &str, yes: bool) -> AppResult<()> {
    let resolved = resolve_profile_by_prefix(&state.db, id)?;

    if !yes && !json {
        use std::io::Write;
        let profiles = state.db.list_profiles()?;
        let display_name = profiles
            .iter()
            .find(|p| p.id == resolved)
            .map(|p| p.name.as_str())
            .unwrap_or(&resolved);
        print!("Delete profile '{}'? [y/N] ", display_name);
        std::io::stdout().flush().ok();
        let mut input = String::new();
        std::io::stdin()
            .read_line(&mut input)
            .map_err(|e| cli_error(e.to_string()))?;
        let trimmed = input.trim();
        if !["y", "Y", "yes", "Yes"].contains(&trimmed) {
            human_output("Cancelled.");
            return Ok(());
        }
    }

    state.db.delete_profile(&resolved)?;
    if json {
        json_output(&format!("{{\"deleted\":\"{}\"}}", resolved));
    } else {
        human_output(&format!("Deleted profile {}", resolved));
    }
    Ok(())
}

fn resolve_profile_by_prefix(
    db: &crate::services::db::Database,
    prefix: &str,
) -> AppResult<String> {
    let profiles = db.list_profiles()?;
    let matches: Vec<_> = profiles
        .iter()
        .filter(|p| p.id.starts_with(prefix) || p.name == prefix)
        .collect();
    match matches.len() {
        0 => Err(AppError::not_found(
            "Profile",
            format!("No profile matches '{prefix}'"),
        )),
        1 => Ok(matches[0].id.clone()),
        _ => Err(AppError::validation_failed(format!(
            "Ambiguous profile prefix '{prefix}' matched {} profiles",
            matches.len()
        ))),
    }
}
