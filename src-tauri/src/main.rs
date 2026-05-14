#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Finder / legacy macOS launches sometimes inject `-psn_0_…` as a second argv entry.
/// Without stripping it, `args.len() > 1` would route into CLI help instead of the GUI.
#[cfg(target_os = "macos")]
fn args_for_entry_mode(args: Vec<String>) -> Vec<String> {
    args.into_iter()
        .enumerate()
        .filter(|(i, a)| *i == 0 || !a.starts_with("-psn_"))
        .map(|(_, a)| a)
        .collect()
}

#[cfg(not(target_os = "macos"))]
fn args_for_entry_mode(args: Vec<String>) -> Vec<String> {
    args
}

fn main() {
    let args = args_for_entry_mode(std::env::args().collect());
    if args.len() > 1 {
        std::process::exit(openloop_lib::cli::run(args));
    }

    openloop_lib::run()
}
