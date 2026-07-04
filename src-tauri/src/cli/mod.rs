mod backend;
mod clear;
mod completions;
mod delete;
mod doctor;
mod enhance;
pub mod events;
mod files;
mod generation;
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
mod warning_output;

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
    // clap expects argv with the program name at index 0; the incoming `args`
    // already includes it, so we pass the whole vector. clap uses args[0] as
    // the binary name and parses the rest as subcommands/flags.
    let cli = spec::Cli::parse_from(args.iter());
    let json = cli.global.json;

    match cli.command {
        spec::Commands::Completions { shell } => {
            let mut cmd = spec::Cli::command();
            completions::print_completions(shell.into(), &mut cmd);
            Ok(())
        }
        command => {
            // Initialize structured tracing before AppState so early failures are
            // captured. Fall back to stderr when the default app data dir is unavailable.
            match crate::app_state::default_app_data_dir() {
                Ok(app_data_dir) => crate::services::observability::init(&app_data_dir),
                Err(_) => crate::services::observability::init_stderr_only(),
            }

            let state = AppState::init_for_cli()?;
            match command {
                spec::Commands::Run(args) => run::execute(&state, json, args),
                spec::Commands::Enhance(args) => enhance::execute(&state, json, args),
                spec::Commands::Backend { command } => backend::execute(&state, json, command),
                spec::Commands::Models { command } => models::execute(&state, json, command),
                spec::Commands::Settings { command } => settings::execute(&state, json, command),
                spec::Commands::Generation { command } => {
                    generation::execute(&state, json, command)
                }
                spec::Commands::List(args) => list::execute(&state, json, args),
                spec::Commands::Delete(args) => delete::execute(&state, json, args),
                spec::Commands::Clear(args) => clear::execute(&state, json, args),
                spec::Commands::Ps => ps::execute(&state, json),
                spec::Commands::Stop(args) => stop::execute(&state, json, args),
                spec::Commands::Pull(args) => pull::execute(&state, json, args),
                spec::Commands::Status => status::execute(&state, json),
                spec::Commands::Doctor => doctor::execute(&state, json),
                spec::Commands::Files { command } => files::execute(&state, json, command),
                spec::Commands::Setup(args) => setup::execute(&state, json, args),
                spec::Commands::Completions { .. } => unreachable!(),
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
