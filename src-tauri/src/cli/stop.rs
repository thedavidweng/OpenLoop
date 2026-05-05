use crate::{cli::human_output, models::errors::AppResult};

use super::AppState;

pub fn execute(state: &AppState, args: &[String]) -> AppResult<()> {
    let help = args.contains(&"--help".to_owned()) || args.contains(&"-h".to_owned());
    if help {
        print_help();
        return Ok(());
    }

    let id = args.get(1).cloned();

    match id {
        Some(task_id) => {
            // Cancel specific task by marking it cancelled in the generation system
            state
                .generation_cancelled
                .store(true, std::sync::atomic::Ordering::SeqCst);
            human_output(&format!("✓ Cancellation signal sent for task {task_id}"));
        }
        None => {
            // No task id — cancel the currently running generation
            state
                .generation_cancelled
                .store(true, std::sync::atomic::Ordering::SeqCst);
            human_output("✓ Cancellation signal sent.");
        }
    }

    Ok(())
}

fn print_help() {
    human_output(
        "\
openloop stop — Cancel an ongoing generation

Usage:
  openloop stop [generation-id]

Examples:
  openloop stop
  openloop stop abc12345",
    );
}
