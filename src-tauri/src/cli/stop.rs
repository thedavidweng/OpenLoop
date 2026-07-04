use crate::{cli::human_output, models::errors::AppResult};

use super::AppState;

pub fn execute(state: &AppState, _json: bool, args: crate::cli::spec::StopArgs) -> AppResult<()> {
    let kill_backend = args.kill_backend;
    let runner = state.generation_runner();

    match &args.generation_id {
        Some(task_id) => {
            let _ = runner.request_cancel_via_db(Some(task_id));
            human_output(&format!("✓ Cancellation signal sent for task {task_id}"));
        }
        _ => {
            state
                .generation_cancelled
                .store(true, std::sync::atomic::Ordering::SeqCst);
            let _ = runner.request_cancel_via_db(None);
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
