const TOP_LEVEL_HELP: &str = "\
♫ OpenLoop — AI music generation

Usage:
  openloop <command> [flags]

Commands:
  run       Generate music
  setup     Configure defaults
  list      Show generation history
  pull      Download a model
  models    List available models
  ps        Show backend status
  delete    Delete a generation record
  clear     Clear all history
  stop      Stop the backend

Global flags:
  --json    Machine-readable JSON output
  --help    Show help for a command

Examples:
  openloop run \"upbeat electronic track\"
  openloop run \"sad piano\" --duration 60 --format mp3 --output ./sad.mp3
  openloop setup
  openloop setup model turbo
  openloop list --json
  openloop pull turbo";

pub fn print_top_level() {
    println!("{TOP_LEVEL_HELP}");
}
