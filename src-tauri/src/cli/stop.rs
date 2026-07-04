use crate::{cli::human_output, models::errors::AppResult};

use super::AppState;

pub(crate) fn cancel_db_warning_message(error: &crate::models::errors::AppError) -> String {
    format!(
        "warning: failed to write cancellation to database: {}",
        error.message
    )
}

pub fn execute(state: &AppState, _json: bool, args: crate::cli::spec::StopArgs) -> AppResult<()> {
    let kill_backend = args.kill_backend;
    let runner = state.generation_runner();

    match &args.generation_id {
        Some(task_id) => match runner.request_cancel_via_db(Some(task_id)) {
            Ok(()) => {
                human_output(&format!("✓ Cancellation signal sent for task {task_id}"));
            }
            Err(e) => {
                eprintln!("{}", cancel_db_warning_message(&e));
            }
        },
        _ => {
            state
                .generation_cancelled
                .store(true, std::sync::atomic::Ordering::SeqCst);
            if let Err(e) = runner.request_cancel_via_db(None) {
                eprintln!("{}", cancel_db_warning_message(&e));
            }
            human_output("✓ Cancellation signal sent.");
        }
    }

    // --kill-backend: stop the backend if we own it
    if kill_backend {
        let mut backend = state.lock_backend()?;
        if backend.is_owned() {
            backend.stop()?;
            human_output("✓ Owned backend stopped.");
        } else {
            human_output("⚠ Backend is not owned by this process; not stopping.");
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::errors::AppError;

    #[test]
    fn cancel_db_warning_message_includes_error_message() {
        let error = AppError::new("TEST", "database is locked", None, true);
        assert!(cancel_db_warning_message(&error).contains("database is locked"));
    }
}
