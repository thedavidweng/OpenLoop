use crate::{cli::human_output, models::errors::AppResult};

use super::AppState;

pub fn execute(state: &AppState, _json: bool, args: crate::cli::spec::StopArgs) -> AppResult<()> {
    let kill_backend = args.kill_backend;

    match &args.generation_id {
        Some(task_id) => {
            let runner = crate::services::generation_task::GenerationTaskRunner::new(
                state.db.clone(),
                crate::services::file_store::FileStore::new(state.app_data_dir.clone()),
                state.generation_cancelled.clone(),
            );
            match runner.request_cancel_via_db(Some(task_id)) {
                Ok(()) => {
                    human_output(&format!("✓ Cancellation signal sent for task {task_id}"));
                }
                Err(e) => {
                    eprintln!(
                        "warning: failed to write cancellation to database: {}",
                        e.message
                    );
                }
            }
        }
        _ => {
            state
                .generation_cancelled
                .store(true, std::sync::atomic::Ordering::SeqCst);
            let runner = crate::services::generation_task::GenerationTaskRunner::new(
                state.db.clone(),
                crate::services::file_store::FileStore::new(state.app_data_dir.clone()),
                state.generation_cancelled.clone(),
            );
            if let Err(e) = runner.request_cancel_via_db(None) {
                eprintln!(
                    "warning: failed to write cancellation to database: {}",
                    e.message
                );
            }
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
