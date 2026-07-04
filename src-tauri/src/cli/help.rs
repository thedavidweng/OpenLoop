const TOP_LEVEL_HELP: &str = "\
♫ OpenLoop — AI music generation

Usage:
  openloop <command> [flags]

Backend commands:
  backend   Manage the ACE-Step local engine (status, start, stop, restart, logs)
  status    Show unified backend, model, and device status
  doctor    Diagnose environment health

Generation commands:
  run       Generate music
  enhance   Enhance a prompt via the local engine
  generation  Manage generation tasks (list, cancel, resume, discard)
  stop      Cancel an ongoing generation

History commands:
  list      Show generation history
  delete    Delete a generation record
  clear     Clear all history

Model commands:
  models    List, download, delete models
  pull      Download a model variant (alias for models download)

File commands:
  files     Manage output files (reveal, copy, exists, unlink)

Settings commands:
  setup     Configure defaults (interactive wizard or key=value)
  settings  Manage settings (get, set, reset, paths)

Shell completions:
  completions  Generate shell completion scripts (bash/zsh/fish/powershell/elvish)

Global flags:
  --json      Machine-readable JSON output
  --version   Print the app version
  --help      Show help for a command

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
