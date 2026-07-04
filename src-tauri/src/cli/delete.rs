use crate::{
    cli::{cli_error, human_output},
    models::errors::AppResult,
    services::history::HistoryService,
};

use super::AppState;

pub fn execute(state: &AppState, json: bool, args: crate::cli::spec::DeleteArgs) -> AppResult<()> {
    let id_arg = args.id;

    let records = state.db.list_generations(None, None)?;

    let record = records
        .iter()
        .find(|r| r.id.starts_with(&id_arg))
        .ok_or_else(|| cli_error(format!("no generation record matches '{id_arg}'")))?;

    let conflicting = records.iter().filter(|r| r.id.starts_with(&id_arg)).count();

    if conflicting > 1 {
        return Err(cli_error(format!(
            "ambiguous prefix '{}' matches {} records. Use a longer prefix.",
            id_arg, conflicting
        )));
    }

    HistoryService::new(state.db.clone()).delete_generation_file_and_record(&record.id)?;

    if json {
        super::json_output(&format!(r#"{{"deleted":"{}"}}"#, record.id));
    } else {
        human_output(&format!(
            "✓ Deleted: {} ({})",
            &record.id[..8.min(record.id.len())],
            record.prompt
        ));
    }

    Ok(())
}
