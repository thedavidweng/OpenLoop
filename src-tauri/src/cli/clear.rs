use crate::{
    cli::{cli_error, human_output},
    models::errors::AppResult,
    services::history::HistoryService,
};

use super::AppState;

pub fn execute(state: &AppState, args: &[String]) -> AppResult<()> {
    let json = args.contains(&"--json".to_owned());
    let yes = args.contains(&"--yes".to_owned());
    let help = args.contains(&"--help".to_owned()) || args.contains(&"-h".to_owned());

    if help {
        print_help();
        return Ok(());
    }

    let records = state.db.list_generations(None)?;
    let count = records.len();

    if count == 0 {
        if json {
            super::json_output(r#"{"cleared":0}"#);
        } else {
            human_output("No history to clear.");
        }
        return Ok(());
    }

    if !json && !yes {
        use std::io::Write;
        print!("Delete {} records and their output files? [y/N] ", count);
        std::io::stdout().flush().ok();
        let mut input = String::new();
        std::io::stdin()
            .read_line(&mut input)
            .map_err(|e| cli_error(e.to_string()))?;
        if !["y\n", "Y\n", "yes\n", "Yes\n"].contains(&input.as_str()) {
            human_output("Cancelled.");
            return Ok(());
        }
    }

    HistoryService::new(state.db.clone()).clear_generation_history()?;

    if json {
        super::json_output(&format!(r#"{{"cleared":{count}}}"#));
    } else {
        human_output(&format!("✓ Cleared {} records and output files.", count));
    }

    Ok(())
}

fn print_help() {
    human_output(
        "\
openloop clear — Clear all generation history

Usage:
  openloop clear [flags]

Flags:
  --json    JSON output
  --yes     Skip confirmation
  --help    Show help",
    );
}
