use crate::{cli::human_output, models::errors::AppResult};

use super::AppState;

pub fn execute(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = args.contains(&"--json".to_owned());
    let help = args.contains(&"--help".to_owned()) || args.contains(&"-h".to_owned());

    if help {
        print_help();
        return Ok(());
    }

    let limit = parse_limit(args);

    let records = state.db.list_generations(None)?;
    let records: Vec<_> = records.into_iter().take(limit).collect();

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

fn parse_limit(args: &[String]) -> usize {
    for i in 0..args.len() {
        if args[i] == "--limit" {
            if let Some(val) = args.get(i + 1) {
                return val.parse::<usize>().unwrap_or(20);
            }
        }
    }
    20
}

fn print_help() {
    human_output(
        "\
openloop list — Show generation history

Usage:
  openloop list [flags]

Flags:
  --json     JSON array output
  --limit N  Number of records (default: 20)
  --help     Show help",
    );
}
