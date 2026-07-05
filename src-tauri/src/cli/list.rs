use crate::{cli::human_output, cli::resolve_project_by_prefix, cli::spec::ListArgs, models::errors::AppResult};

use super::AppState;

pub fn execute(state: &AppState, json: bool, args: ListArgs) -> AppResult<()> {
    let limit = args.limit;

    let records = match args.project.as_deref() {
        Some(prefix) => {
            let project_id = resolve_project_by_prefix(&state.db, prefix)?;
            state
                .db
                .list_generations_by_project(&project_id, Some(limit as u32))?
        }
        None => state.db.list_generations(None, Some(limit as u32))?,
    };

    if json {
        let json_output = serde_json::to_string_pretty(&records)
            .map_err(|e| crate::cli::cli_error(e.to_string()))?;
        super::json_output(&json_output);
    } else {
        if records.is_empty() {
            human_output("No generation history.");
            return Ok(());
        }

        // Table header
        println!(
            "{:<12} {:<24} {:<10} {:<8} Created",
            r#"ID"#, r#"Prompt"#, r#"Duration"#, r#"Format"#
        );
        let separator = "-".repeat(80);
        println!("{separator}");

        for record in &records {
            let short_id = &record.id[..8.min(record.id.len())];
            let prompt = if record.prompt.len() > 22 {
                format!("{}…", &record.prompt[..21])
            } else {
                record.prompt.clone()
            };
            let duration = format!("{}s", record.duration_seconds as i64);
            let created_raw = record.created_at.replace('T', " ");
            let created = created_raw.split('.').next().unwrap_or(&record.created_at);

            println!(
                "{:<12} {:<24} {:<10} {:<8} {}",
                short_id, prompt, duration, record.audio_format, created
            );
        }

        if records.len() >= limit {
            human_output(&format!("… showing first {} records", limit));
        }
    }

    Ok(())
}
