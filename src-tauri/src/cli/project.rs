use crate::{
    cli::{cli_error, human_output, json_output, resolve_project_by_prefix, spec::ProjectCommand},
    models::errors::{AppError, AppResult},
};

use super::AppState;

pub fn execute(state: &AppState, json: bool, command: ProjectCommand) -> AppResult<()> {
    match command {
        ProjectCommand::List => cmd_list(state, json),
        ProjectCommand::Create { name } => cmd_create(state, json, &name),
        ProjectCommand::Rename { id, name } => cmd_rename(state, json, &id, &name),
        ProjectCommand::Delete { id, yes } => cmd_delete(state, json, &id, yes),
        ProjectCommand::Assign { generation, project } => {
            cmd_assign(state, json, &generation, project.as_deref())
        }
    }
}

fn cmd_list(state: &AppState, json: bool) -> AppResult<()> {
    let projects = state.db.list_projects()?;

    if json {
        let output =
            serde_json::to_string_pretty(&projects).map_err(|e| cli_error(e.to_string()))?;
        json_output(&output);
    } else {
        if projects.is_empty() {
            human_output("No projects.");
            return Ok(());
        }
        println!("{:<12} {:<28} Created", "ID", "Name");
        println!("{}", "-".repeat(60));
        for project in &projects {
            let short_id = &project.id[..8.min(project.id.len())];
            let name = if project.name.len() > 26 {
                format!("{}…", &project.name[..25])
            } else {
                project.name.clone()
            };
            let created = project
                .created_at
                .split('T')
                .next()
                .unwrap_or(&project.created_at);
            println!("{:<12} {:<28} {}", short_id, name, created);
        }
    }
    Ok(())
}

fn cmd_create(state: &AppState, json: bool, name: &str) -> AppResult<()> {
    let project = state.db.create_project(name)?;
    if json {
        let output =
            serde_json::to_string_pretty(&project).map_err(|e| cli_error(e.to_string()))?;
        json_output(&output);
    } else {
        human_output(&format!(
            "Created project '{}' (id: {})",
            project.name, project.id
        ));
    }
    Ok(())
}

fn cmd_rename(state: &AppState, json: bool, id: &str, name: &str) -> AppResult<()> {
    let resolved = resolve_project_by_prefix(&state.db, id)?;
    let project = state.db.rename_project(&resolved, name)?;
    if json {
        let output =
            serde_json::to_string_pretty(&project).map_err(|e| cli_error(e.to_string()))?;
        json_output(&output);
    } else {
        human_output(&format!("Renamed project {} to '{}'", resolved, name));
    }
    Ok(())
}

fn cmd_delete(state: &AppState, json: bool, id: &str, yes: bool) -> AppResult<()> {
    let resolved = resolve_project_by_prefix(&state.db, id)?;

    if !yes {
        use std::io::Write;
        let projects = state.db.list_projects()?;
        let display_name = projects
            .iter()
            .find(|p| p.id == resolved)
            .map(|p| p.name.as_str())
            .unwrap_or(&resolved);
        print!(
            "Delete project '{}'? Generations will be unassigned, not deleted. [y/N] ",
            display_name
        );
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

    state.db.delete_project(&resolved)?;
    if json {
        json_output(&format!("{{\"deleted\":\"{}\"}}", resolved));
    } else {
        human_output(&format!("Deleted project {}", resolved));
    }
    Ok(())
}

fn cmd_assign(
    state: &AppState,
    json: bool,
    generation: &str,
    project: Option<&str>,
) -> AppResult<()> {
    let generation_id = resolve_generation_by_prefix(state, generation)?;

    let project_id = match project {
        Some(value) => Some(resolve_project_by_prefix(&state.db, value)?),
        None => None,
    };

    state
        .db
        .set_generation_project(&generation_id, project_id.as_deref())?;

    if json {
        json_output(&format!(
            "{{\"generationId\":\"{}\",\"projectId\":{}}}",
            generation_id,
            project_id
                .as_ref()
                .map(|id| format!("\"{}\"", id))
                .unwrap_or_else(|| "null".to_string())
        ));
    } else {
        match project_id {
            Some(id) => human_output(&format!(
                "Assigned generation {} to project {}",
                generation_id, id
            )),
            None => human_output(&format!("Unassigned generation {} from project", generation_id)),
        }
    }
    Ok(())
}

fn resolve_generation_by_prefix(state: &AppState, prefix: &str) -> AppResult<String> {
    let matches = state.db.find_generation_ids_by_prefix(prefix)?;
    match matches.len() {
        0 => Err(AppError::not_found(
            "Generation record",
            format!("No generation record matches '{prefix}'"),
        )),
        1 => Ok(matches[0].clone()),
        _ => Err(AppError::validation_failed(format!(
            "Ambiguous generation prefix '{prefix}' matched {} records",
            matches.len()
        ))),
    }
}
