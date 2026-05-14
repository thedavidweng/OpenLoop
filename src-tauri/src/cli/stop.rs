use crate::{cli::human_output, models::errors::AppResult};

use super::AppState;

pub fn execute(state: &AppState, args: &[String]) -> AppResult<()> {
    let help = args.contains(&"--help".to_owned()) || args.contains(&"-h".to_owned());
    let kill_backend = args.contains(&"--kill-backend".to_owned());

    if help {
        print_help();
        return Ok(());
    }

    let id = args.get(1).cloned();

    match id {
        Some(ref task_id) if !task_id.starts_with('-') => {
            // Targeted DB-level cancellation for cross-process visibility
            let runner = crate::services::generation_task::GenerationTaskRunner::new(
                state.db.clone(),
                crate::services::file_store::FileStore::new(state.app_data_dir.clone()),
                state.generation_cancelled.clone(),
            );
            let _ = runner.request_cancel_via_db(Some(task_id));
            human_output(&format!("✓ Cancellation signal sent for task {task_id}"));
        }
        _ => {
            // Global cancellation via process-level flag and DB-level for all active tasks
            state
                .generation_cancelled
                .store(true, std::sync::atomic::Ordering::SeqCst);
            let runner = crate::services::generation_task::GenerationTaskRunner::new(
                state.db.clone(),
                crate::services::file_store::FileStore::new(state.app_data_dir.clone()),
                state.generation_cancelled.clone(),
            );
            let _ = runner.request_cancel_via_db(None);
            human_output("✓ Cancellation signal sent.");
        }
    }

    // --kill-backend: stop the backend if we own it
    if kill_backend {
        let mut backend = state
            .backend
            .lock()
            .map_err(|e| crate::models::errors::AppError::internal(format!("backend lock: {e}")))?;
        if backend.is_owned() {
            backend.stop()?;
            human_output("✓ Owned backend stopped.");
        } else {
            human_output("⚠ Backend is not owned by this process; not stopping.");
        }
    }

    Ok(())
}

fn print_help() {
    human_output(
        "\
openloop stop — Cancel an ongoing generation

Usage:
  openloop stop [generation-id] [flags]

Flags:
  --kill-backend  Also stop the local backend if owned by this process
  --help          Show help

Examples:
  openloop stop
  openloop stop abc12345
  openloop stop --kill-backend",
    );
}
