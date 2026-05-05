#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args = std::env::args().collect::<Vec<_>>();
    if args.len() > 1 {
        std::process::exit(openloop_lib::cli::run(args));
    }

    openloop_lib::run()
}
