mod backend;
mod clear;
mod completions;
mod delete;
mod doctor;
mod enhance;
pub mod events;
mod files;
mod generation;
mod help;
mod list;
mod models;
mod ps;
mod pull;
mod run;
mod settings;
mod setup;
mod spec;
mod status;
mod stop;

use clap::{CommandFactory, Parser};

use crate::{
    app_state::AppState,
    models::errors::{AppError, AppResult},
};

pub fn run(args: Vec<String>) -> i32 {
    match run_inner(args) {
        Ok(()) => 0,
        Err(error) => {
            let msg = error.details.as_deref().unwrap_or(&error.message);
            eprintln!("\x1b[31m✗\x1b[0m Error: {msg}");
            error.exit_code()
        }
    }
}

fn run_inner(args: Vec<String>) -> AppResult<()> {
    // Handle the hidden completions command via clap derive so it can emit
    // shell completion scripts for bash/zsh/fish/powershell/elvish.
    if args.get(1).is_some_and(|s| s == "completions") {
        let parsed = spec::Cli::try_parse_from(&args)
            .map_err(|e| AppError::validation_failed(first_line(&e.to_string())))?;
        let spec::Commands::Completions { shell } = parsed.command else {
            unreachable!("args[1] == \"completions\" guarantees the Completions variant")
        };
        let mut cmd = spec::Cli::command();
        completions::print_completions(shell.into(), &mut cmd);
        return Ok(());
    }

    // Initialize structured tracing before AppState so early failures are
    // captured. Fall back to stderr when the default app data dir is unavailable.
    match crate::app_state::default_app_data_dir() {
        Ok(app_data_dir) => crate::services::observability::init(&app_data_dir),
        Err(_) => crate::services::observability::init_stderr_only(),
    }

    let state = AppState::init_for_cli()?;

    let command = args.get(1).map(String::as_str).unwrap_or("help");
    let sub_args = &args[1..];

    match command {
        "backend" => backend::execute(&state, sub_args),
        "clear" => clear::execute(&state, sub_args),
        "delete" => delete::execute(&state, sub_args),
        "doctor" => doctor::execute(&state, sub_args),
        "enhance" => enhance::execute(&state, sub_args),
        "files" => files::execute(&state, sub_args),
        "generation" => generation::execute(&state, sub_args),
        "list" => list::execute(&state, sub_args),
        "models" => models::execute(&state, sub_args),
        "ps" => ps::execute(&state, sub_args),
        "pull" => pull::execute(&state, sub_args),
        "run" => run::execute(&state, sub_args),
        "settings" => settings::execute(&state, sub_args),
        "setup" => setup::execute(&state, sub_args),
        "status" => status::execute(&state, sub_args),
        "stop" => stop::execute(&state, sub_args),
        "help" | "--help" | "-h" => {
            help::print_top_level();
            Ok(())
        }
        "--version" | "-V" => {
            println!("{}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        unknown => {
            if unknown.starts_with('-') {
                help::print_top_level();
                Ok(())
            } else {
                Err(AppError::validation_failed(format!(
                    "unknown command '{}'. Use 'openloop help' to see available commands.",
                    unknown
                )))
            }
        }
    }
}

pub fn cli_error(message: impl Into<String>) -> AppError {
    AppError::validation_failed(message)
}

/// Extract the first non-empty line of `s`, trimming surrounding whitespace.
///
/// Used to surface clap parse errors without dragging clap's multi-line usage
/// block (which carries its own ANSI styling and newlines) through the app's
/// error formatter.
fn first_line(s: &str) -> String {
    s.lines()
        .find(|line| !line.trim().is_empty())
        .map(str::trim)
        .map(str::to_owned)
        .unwrap_or_default()
}

pub fn json_output(json: &str) {
    println!("{json}");
}

pub fn human_output(line: &str) {
    println!("{line}");
}

pub fn human_error(line: &str) {
    eprintln!("\x1b[31m✗\x1b[0m Error: {line}");
}
