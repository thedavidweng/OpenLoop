mod clear;
mod delete;
mod help;
mod list;
mod models;
mod ps;
mod pull;
mod run;
mod setup;
mod stop;

use crate::{
    app_state::AppState,
    models::errors::{AppError, AppResult},
};

pub fn run(args: Vec<String>) -> i32 {
    match run_inner(args) {
        Ok(()) => 0,
        Err(error) => {
            eprintln!("\x1b[31m✗\x1b[0m Error: {}", error.message);
            1
        }
    }
}

fn run_inner(args: Vec<String>) -> AppResult<()> {
    let state = AppState::init_for_cli()?;

    let command = args.get(1).map(String::as_str).unwrap_or("help");
    let sub_args = &args[1..];

    match command {
        "run" => run::execute(&state, sub_args),
        "setup" => setup::execute(&state, sub_args),
        "list" => list::execute(&state, sub_args),
        "pull" => pull::execute(&state, sub_args),
        "models" => models::execute(&state, sub_args),
        "ps" => ps::execute(&state, sub_args),
        "delete" => delete::execute(&state, sub_args),
        "clear" => clear::execute(&state, sub_args),
        "stop" => stop::execute(&state, sub_args),
        "help" | "--help" | "-h" => {
            help::print_top_level();
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

pub fn json_output(json: &str) {
    println!("{json}");
}

pub fn human_output(line: &str) {
    println!("{line}");
}

pub fn human_error(line: &str) {
    eprintln!("\x1b[31m✗\x1b[0m Error: {line}");
}
