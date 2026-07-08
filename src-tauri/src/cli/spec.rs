// Single source of truth for CLI parsing: `mod.rs` calls `Cli::parse_from` and
// routes typed structs to each subcommand. When adding, removing, or renaming a
// command, update this `Cli`/`Commands` definition and the `match` arm in `mod.rs`.

use clap::{Args, Parser, Subcommand, ValueEnum};

use crate::models::settings::ModelVariant;

#[derive(Parser)]
#[command(name = "openloop", about = "AI music generation", version)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    #[command(flatten)]
    pub global: GlobalArgs,
}

#[derive(Args)]
pub struct GlobalArgs {
    /// Output in JSON/NDJSON format
    #[arg(long, global = true)]
    pub json: bool,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Generate music from a text prompt
    Run(RunArgs),
    /// Enhance a prompt via ACE-Step format_input
    Enhance(EnhanceArgs),
    /// Manage the local ACE-Step backend
    Backend {
        #[command(subcommand)]
        command: BackendCommand,
    },
    /// Manage model variants
    Models {
        #[command(subcommand)]
        command: Option<ModelsCommand>,
    },
    /// View and modify application settings
    Settings {
        #[command(subcommand)]
        command: Option<SettingsCommand>,
    },
    /// Manage generation lifecycle
    Generation {
        #[command(subcommand)]
        command: GenerationCommand,
    },
    /// Show generation history
    List(ListArgs),
    /// Manage projects (named groups of generations)
    Project {
        #[command(subcommand)]
        command: ProjectCommand,
    },
    /// Delete a generation record
    Delete(DeleteArgs),
    /// Clear all generation history
    Clear(ClearArgs),
    /// Show backend status and active generation tasks
    Ps,
    /// Cancel an ongoing generation
    Stop(StopArgs),
    /// Download a model variant
    Pull(PullArgs),
    /// Show unified system status
    Status,
    /// Run environment diagnostics
    Doctor,
    /// File and output management
    Files {
        #[command(subcommand)]
        command: FilesCommand,
    },
    /// Configure default settings
    Setup(SetupArgs),
    /// Generate shell completion scripts
    #[command(hide = true)]
    Completions {
        /// Shell to generate completions for
        #[arg(value_enum)]
        shell: Shell,
    },
}

// ---------------------------------------------------------------------------
// Run & Enhance
// ---------------------------------------------------------------------------

#[derive(Args)]
pub struct RunArgs {
    /// The text prompt for music generation
    pub prompt: String,

    /// Model variant (lite/turbo/pro)
    #[arg(short = 'm', long)]
    pub model: Option<String>,

    /// Duration in seconds (10-600)
    #[arg(short = 'd', long)]
    pub duration: Option<f64>,

    /// Audio format (wav/mp3/flac/ogg)
    #[arg(short = 'f', long)]
    pub format: Option<String>,

    /// Output file path
    #[arg(short = 'o', long)]
    pub output: Option<String>,

    /// Lyrics text
    #[arg(short = 'l', long)]
    pub lyrics: Option<String>,

    /// BPM (30-300)
    #[arg(long)]
    pub bpm: Option<i64>,

    /// Key and scale (e.g., "C major")
    #[arg(long)]
    pub key: Option<String>,

    /// Inference steps
    #[arg(long)]
    pub steps: Option<i64>,

    /// Guidance scale
    #[arg(long)]
    pub guidance: Option<f64>,

    /// Random seed
    #[arg(long)]
    pub seed: Option<i64>,

    /// Number of variations (1-4)
    #[arg(short = 'v', long)]
    pub variations: Option<i64>,

    /// Disable thinking mode
    #[arg(long)]
    pub no_thinking: bool,

    /// Replay a previous generation by ID
    #[arg(long)]
    pub from_history: Option<String>,

    /// Assign the generation to a project (by name or ID prefix)
    #[arg(long)]
    pub project: Option<String>,
}

#[derive(Args)]
pub struct EnhanceArgs {
    /// The text prompt to enhance (one or more words)
    #[arg(required = true, num_args = 1.., trailing_var_arg = true, allow_hyphen_values = true)]
    pub prompt: Vec<String>,

    /// Duration in seconds (10-600)
    #[arg(short = 'd', long)]
    pub duration: Option<f64>,

    /// Include lyrics in the request
    #[arg(short = 'l', long)]
    pub lyrics: Option<String>,
}

// ---------------------------------------------------------------------------
// Backend (8 sub-subcommands)
// ---------------------------------------------------------------------------

#[derive(Subcommand)]
pub enum BackendCommand {
    /// Show backend status
    Status,
    /// Start the backend
    Start,
    /// Stop the backend
    Stop,
    /// Restart the backend
    Restart,
    /// Show backend logs
    Logs {
        /// Open logs directory in Finder
        #[arg(long)]
        open: bool,
    },
    /// Clear backend cache
    ClearCache,
    /// Download and install the backend
    Provision,
    /// Update the backend to the latest version
    Update,
}

// ---------------------------------------------------------------------------
// Models (6 sub-subcommands)
// ---------------------------------------------------------------------------

#[derive(Subcommand)]
pub enum ModelsCommand {
    /// List model variants and download status
    List,
    /// Download a model variant
    Download {
        /// Model variant
        #[arg(value_enum)]
        variant: ModelVariantArg,
    },
    /// Delete a model variant
    Delete {
        /// Model variant
        #[arg(value_enum)]
        variant: ModelVariantArg,
    },
    /// Cancel an in-progress model download
    Cancel {
        /// Model variant
        #[arg(value_enum)]
        variant: ModelVariantArg,
    },
    /// Clear partially downloaded model files
    ClearPartial {
        /// Model variant
        #[arg(value_enum)]
        variant: ModelVariantArg,
    },
    /// Delete all downloaded models
    DeleteAll {
        /// Skip confirmation
        #[arg(long)]
        yes: bool,
    },
}

#[derive(Clone, ValueEnum)]
pub enum ModelVariantArg {
    Lite,
    Turbo,
    Pro,
}

impl From<ModelVariantArg> for ModelVariant {
    fn from(arg: ModelVariantArg) -> Self {
        match arg {
            ModelVariantArg::Lite => ModelVariant::Lite,
            ModelVariantArg::Turbo => ModelVariant::Turbo,
            ModelVariantArg::Pro => ModelVariant::Pro,
        }
    }
}

// ---------------------------------------------------------------------------
// Settings (4 sub-subcommands)
// ---------------------------------------------------------------------------

#[derive(Subcommand)]
pub enum SettingsCommand {
    /// Show current settings (default)
    #[command(alias = "show")]
    Get,
    /// Set a setting value
    Set {
        /// Setting key
        key: String,
        /// Setting value
        value: String,
    },
    /// Reset all settings to defaults
    Reset {
        /// Skip confirmation
        #[arg(long)]
        yes: bool,
    },
    /// Show settings file paths
    Paths,
}

// ---------------------------------------------------------------------------
// Generation (4 sub-subcommands)
// ---------------------------------------------------------------------------

#[derive(Subcommand)]
pub enum GenerationCommand {
    /// List active generation tasks
    List,
    /// Cancel generation task(s)
    Cancel {
        /// Task ID to cancel (omit to cancel all)
        id: Option<String>,
        /// Also stop the backend
        #[arg(long)]
        kill_backend: bool,
    },
    /// Resume a paused generation
    Resume {
        /// Task ID to resume
        id: String,
    },
    /// Discard a generation result
    Discard {
        /// Task ID to discard
        id: String,
        /// Skip confirmation
        #[arg(long)]
        yes: bool,
    },
}

#[derive(Subcommand)]
pub enum ProjectCommand {
    /// List all projects
    List,
    /// Create a new project
    Create {
        /// Project name
        name: String,
    },
    /// Rename an existing project
    Rename {
        /// Project ID prefix
        id: String,
        /// New project name
        name: String,
    },
    /// Delete a project (generations are unassigned, not deleted)
    Delete {
        /// Project ID prefix
        id: String,
        /// Skip confirmation
        #[arg(long)]
        yes: bool,
    },
    /// Assign a generation to a project
    Assign {
        /// Generation ID prefix
        generation: String,
        /// Project ID prefix (omit to unassign)
        #[arg(long)]
        project: Option<String>,
    },
}

// ---------------------------------------------------------------------------
// Leaf commands
// ---------------------------------------------------------------------------

#[derive(Args)]
pub struct ListArgs {
    /// Number of records to show
    #[arg(long, default_value = "20")]
    pub limit: usize,

    /// Filter by project (by name or ID prefix)
    #[arg(long)]
    pub project: Option<String>,
}

#[derive(Args)]
pub struct DeleteArgs {
    /// Generation record ID prefix
    pub id: String,
}

#[derive(Args)]
pub struct ClearArgs {
    /// Skip confirmation
    #[arg(long)]
    pub yes: bool,
}

#[derive(Args)]
pub struct StopArgs {
    /// Generation ID to cancel (omit to cancel all)
    pub generation_id: Option<String>,
    /// Also stop the backend
    #[arg(long)]
    pub kill_backend: bool,
}

#[derive(Args)]
pub struct PullArgs {
    /// Model variant to download
    #[arg(value_enum)]
    pub model: ModelVariantArg,
    /// Use one or more mirror sources (repeat --mirror for each)
    #[arg(long, action = clap::ArgAction::Append)]
    pub mirror: Vec<String>,
}

#[derive(Args)]
pub struct SetupArgs {
    /// Setting key (model, thinking, duration, format, checkForUpdates)
    pub key: Option<String>,
    /// Setting value
    pub value: Option<String>,

    /// Set model variant
    #[arg(long)]
    pub model: Option<String>,
    /// Set thinking mode
    #[arg(long)]
    pub thinking: Option<String>,
    /// Set default duration
    #[arg(long)]
    pub duration: Option<f64>,
    /// Set default audio format
    #[arg(long)]
    pub format: Option<String>,
}

// ---------------------------------------------------------------------------
// Files (6 sub-subcommands)
// ---------------------------------------------------------------------------

#[derive(Subcommand)]
pub enum FilesCommand {
    /// Reveal a file in Finder
    Reveal {
        /// File path
        path: String,
    },
    /// Copy a file
    Copy {
        /// Source path
        src: String,
        /// Destination path
        dst: String,
    },
    /// Check if a file exists
    Exists {
        /// File path
        path: String,
    },
    /// Read audio file for a generation
    ReadAudio {
        /// Generation record ID prefix
        id: String,
        /// Output path (use - for stdout)
        #[arg(short = 'o', long)]
        output: Option<String>,
    },
    /// Generate a waveform visualization
    Waveform {
        /// Generation record ID prefix
        id: String,
    },
    /// Delete the output file for a generation
    Unlink {
        /// Generation record ID prefix
        id: String,
        /// Keep the database record
        #[arg(long)]
        keep_record: bool,
    },
}

// ---------------------------------------------------------------------------
// Shell completions
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, ValueEnum)]
#[allow(clippy::enum_variant_names)]
pub enum Shell {
    Bash,
    Zsh,
    Fish,
    PowerShell,
    Elvish,
}

impl From<Shell> for clap_complete::Shell {
    fn from(shell: Shell) -> Self {
        match shell {
            Shell::Bash => clap_complete::Shell::Bash,
            Shell::Zsh => clap_complete::Shell::Zsh,
            Shell::Fish => clap_complete::Shell::Fish,
            Shell::PowerShell => clap_complete::Shell::PowerShell,
            Shell::Elvish => clap_complete::Shell::Elvish,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;

    // -----------------------------------------------------------------------
    // Run
    // -----------------------------------------------------------------------

    #[test]
    fn parse_run_with_prompt_only() {
        let cli = Cli::try_parse_from(["openloop", "run", "upbeat electronic track"]).unwrap();
        match cli.command {
            Commands::Run(args) => {
                assert_eq!(args.prompt, "upbeat electronic track");
                assert!(args.model.is_none());
                assert!(args.duration.is_none());
            }
            _ => panic!("expected Run command"),
        }
        assert!(!cli.global.json);
    }

    #[test]
    fn parse_run_with_all_flags() {
        let cli = Cli::try_parse_from([
            "openloop",
            "run",
            "sad piano",
            "--model",
            "pro",
            "--duration",
            "60",
            "--format",
            "mp3",
            "--output",
            "./sad.mp3",
            "--lyrics",
            "[verse]\\nHello",
            "--bpm",
            "120",
            "--key",
            "C major",
            "--steps",
            "16",
            "--guidance",
            "8.5",
            "--seed",
            "42",
            "--variations",
            "2",
            "--no-thinking",
        ])
        .unwrap();

        match cli.command {
            Commands::Run(args) => {
                assert_eq!(args.prompt, "sad piano");
                assert_eq!(args.model.as_deref(), Some("pro"));
                assert_eq!(args.duration, Some(60.0));
                assert_eq!(args.format.as_deref(), Some("mp3"));
                assert_eq!(args.output.as_deref(), Some("./sad.mp3"));
                assert_eq!(args.lyrics.as_deref(), Some("[verse]\\nHello"));
                assert_eq!(args.bpm, Some(120));
                assert_eq!(args.key.as_deref(), Some("C major"));
                assert_eq!(args.steps, Some(16));
                assert_eq!(args.guidance, Some(8.5));
                assert_eq!(args.seed, Some(42));
                assert_eq!(args.variations, Some(2));
                assert!(args.no_thinking);
            }
            _ => panic!("expected Run command"),
        }
    }

    #[test]
    fn parse_run_with_short_flags() {
        let cli = Cli::try_parse_from([
            "openloop",
            "run",
            "epic cinematic",
            "-m",
            "turbo",
            "-d",
            "120",
            "-f",
            "flac",
            "-o",
            "./output.flac",
            "-l",
            "lyrics here",
            "-v",
            "3",
        ])
        .unwrap();

        match cli.command {
            Commands::Run(args) => {
                assert_eq!(args.prompt, "epic cinematic");
                assert_eq!(args.model.as_deref(), Some("turbo"));
                assert_eq!(args.duration, Some(120.0));
                assert_eq!(args.format.as_deref(), Some("flac"));
                assert_eq!(args.output.as_deref(), Some("./output.flac"));
                assert_eq!(args.lyrics.as_deref(), Some("lyrics here"));
                assert_eq!(args.variations, Some(3));
            }
            _ => panic!("expected Run command"),
        }
    }

    #[test]
    fn parse_run_global_json_flag() {
        let cli = Cli::try_parse_from(["openloop", "--json", "run", "test"]).unwrap();
        assert!(cli.global.json);
        match cli.command {
            Commands::Run(args) => assert_eq!(args.prompt, "test"),
            _ => panic!("expected Run command"),
        }
    }

    // -----------------------------------------------------------------------
    // Enhance
    // -----------------------------------------------------------------------

    #[test]
    fn parse_enhance_with_prompt_only() {
        let cli = Cli::try_parse_from(["openloop", "enhance", "warm", "piano"]).unwrap();
        match cli.command {
            Commands::Enhance(args) => {
                assert_eq!(args.prompt, vec!["warm", "piano"]);
                assert!(args.duration.is_none());
                assert!(args.lyrics.is_none());
            }
            _ => panic!("expected Enhance command"),
        }
    }

    #[test]
    fn parse_enhance_unquoted_multi_word_prompt() {
        let cli = Cli::try_parse_from(["openloop", "enhance", "warm", "piano", "jazz"]).unwrap();
        match cli.command {
            Commands::Enhance(args) => {
                assert_eq!(args.prompt, vec!["warm", "piano", "jazz"]);
            }
            _ => panic!("expected Enhance command"),
        }
    }

    #[test]
    fn parse_enhance_with_flags() {
        let cli = Cli::try_parse_from([
            "openloop",
            "enhance",
            "--duration",
            "120",
            "--lyrics",
            "[Verse]\\nHello",
            "upbeat pop",
        ])
        .unwrap();

        match cli.command {
            Commands::Enhance(args) => {
                assert_eq!(args.prompt, vec!["upbeat pop"]);
                assert_eq!(args.duration, Some(120.0));
                assert_eq!(args.lyrics.as_deref(), Some("[Verse]\\nHello"));
            }
            _ => panic!("expected Enhance command"),
        }
    }

    #[test]
    fn parse_enhance_with_short_flags() {
        let cli =
            Cli::try_parse_from(["openloop", "enhance", "-d", "60", "-l", "lyrics", "ballad"])
                .unwrap();

        match cli.command {
            Commands::Enhance(args) => {
                assert_eq!(args.prompt, vec!["ballad"]);
                assert_eq!(args.duration, Some(60.0));
                assert_eq!(args.lyrics.as_deref(), Some("lyrics"));
            }
            _ => panic!("expected Enhance command"),
        }
    }

    // -----------------------------------------------------------------------
    // Error cases
    // -----------------------------------------------------------------------

    #[test]
    fn parse_run_missing_prompt_fails() {
        let result = Cli::try_parse_from(["openloop", "run"]);
        assert!(result.is_err());
    }

    #[test]
    fn parse_enhance_missing_prompt_fails() {
        let result = Cli::try_parse_from(["openloop", "enhance"]);
        assert!(result.is_err());
    }

    #[test]
    fn parse_unknown_subcommand_fails() {
        let result = Cli::try_parse_from(["openloop", "bogus"]);
        assert!(result.is_err());
    }

    // -----------------------------------------------------------------------
    // Completions
    // -----------------------------------------------------------------------

    #[test]
    fn parse_completions_zsh() {
        let cli = Cli::try_parse_from(["openloop", "completions", "zsh"]).unwrap();
        match cli.command {
            Commands::Completions { shell } => assert!(matches!(shell, Shell::Zsh)),
            _ => panic!("expected Completions command"),
        }
    }

    #[test]
    fn parse_completions_bash() {
        let cli = Cli::try_parse_from(["openloop", "completions", "bash"]).unwrap();
        match cli.command {
            Commands::Completions { shell } => assert!(matches!(shell, Shell::Bash)),
            _ => panic!("expected Completions command"),
        }
    }

    #[test]
    fn parse_completions_missing_shell_fails() {
        let result = Cli::try_parse_from(["openloop", "completions"]);
        assert!(result.is_err());
    }

    // -----------------------------------------------------------------------
    // Backend
    // -----------------------------------------------------------------------

    #[test]
    fn parse_backend_status() {
        let cli = Cli::try_parse_from(["openloop", "backend", "status"]).unwrap();
        match cli.command {
            Commands::Backend {
                command: BackendCommand::Status,
            } => {}
            _ => panic!("expected Backend::Status"),
        }
    }

    #[test]
    fn parse_backend_logs_with_open() {
        let cli = Cli::try_parse_from(["openloop", "backend", "logs", "--open"]).unwrap();
        match cli.command {
            Commands::Backend {
                command: BackendCommand::Logs { open },
            } => assert!(open),
            _ => panic!("expected Backend::Logs"),
        }
    }

    #[test]
    fn parse_backend_all_subcommands() {
        for sub in [
            "status",
            "start",
            "stop",
            "restart",
            "clear-cache",
            "provision",
            "update",
        ] {
            let result = Cli::try_parse_from(["openloop", "backend", sub]);
            assert!(result.is_ok(), "failed to parse: backend {sub}");
        }
    }

    // -----------------------------------------------------------------------
    // Models
    // -----------------------------------------------------------------------

    #[test]
    fn parse_models_list_default() {
        let cli = Cli::try_parse_from(["openloop", "models"]).unwrap();
        match cli.command {
            Commands::Models { command: None } => {}
            _ => panic!("expected Models with no subcommand"),
        }
    }

    #[test]
    fn parse_models_download_variant() {
        let cli = Cli::try_parse_from(["openloop", "models", "download", "pro"]).unwrap();
        match cli.command {
            Commands::Models {
                command: Some(ModelsCommand::Download { variant }),
            } => {
                assert!(matches!(variant, ModelVariantArg::Pro));
            }
            _ => panic!("expected Models::Download"),
        }
    }

    #[test]
    fn parse_models_delete_variant() {
        let cli = Cli::try_parse_from(["openloop", "models", "delete", "turbo"]).unwrap();
        match cli.command {
            Commands::Models {
                command: Some(ModelsCommand::Delete { variant }),
            } => {
                assert!(matches!(variant, ModelVariantArg::Turbo));
            }
            _ => panic!("expected Models::Delete"),
        }
    }

    #[test]
    fn parse_models_delete_all_with_yes() {
        let cli = Cli::try_parse_from(["openloop", "models", "delete-all", "--yes"]).unwrap();
        match cli.command {
            Commands::Models {
                command: Some(ModelsCommand::DeleteAll { yes }),
            } => assert!(yes),
            _ => panic!("expected Models::DeleteAll"),
        }
    }

    // -----------------------------------------------------------------------
    // Settings
    // -----------------------------------------------------------------------

    #[test]
    fn parse_settings_get_default() {
        let cli = Cli::try_parse_from(["openloop", "settings"]).unwrap();
        match cli.command {
            Commands::Settings { command: None } => {}
            _ => panic!("expected Settings with no subcommand"),
        }
    }

    #[test]
    fn parse_settings_set_key_value() {
        let cli =
            Cli::try_parse_from(["openloop", "settings", "set", "modelVariant", "pro"]).unwrap();
        match cli.command {
            Commands::Settings {
                command: Some(SettingsCommand::Set { key, value }),
            } => {
                assert_eq!(key, "modelVariant");
                assert_eq!(value, "pro");
            }
            _ => panic!("expected Settings::Set"),
        }
    }

    #[test]
    fn parse_settings_reset_with_yes() {
        let cli = Cli::try_parse_from(["openloop", "settings", "reset", "--yes"]).unwrap();
        match cli.command {
            Commands::Settings {
                command: Some(SettingsCommand::Reset { yes }),
            } => assert!(yes),
            _ => panic!("expected Settings::Reset"),
        }
    }

    // -----------------------------------------------------------------------
    // Generation
    // -----------------------------------------------------------------------

    #[test]
    fn parse_generation_list() {
        let cli = Cli::try_parse_from(["openloop", "generation", "list"]).unwrap();
        match cli.command {
            Commands::Generation {
                command: GenerationCommand::List,
            } => {}
            _ => panic!("expected Generation::List"),
        }
    }

    #[test]
    fn parse_generation_cancel_with_id() {
        let cli = Cli::try_parse_from(["openloop", "generation", "cancel", "abc123"]).unwrap();
        match cli.command {
            Commands::Generation {
                command: GenerationCommand::Cancel { id, kill_backend },
            } => {
                assert_eq!(id.as_deref(), Some("abc123"));
                assert!(!kill_backend);
            }
            _ => panic!("expected Generation::Cancel"),
        }
    }

    #[test]
    fn parse_generation_cancel_all() {
        let cli = Cli::try_parse_from(["openloop", "generation", "cancel"]).unwrap();
        match cli.command {
            Commands::Generation {
                command: GenerationCommand::Cancel { id, .. },
            } => {
                assert!(id.is_none());
            }
            _ => panic!("expected Generation::Cancel"),
        }
    }

    #[test]
    fn parse_generation_cancel_kill_backend() {
        let cli =
            Cli::try_parse_from(["openloop", "generation", "cancel", "--kill-backend"]).unwrap();
        match cli.command {
            Commands::Generation {
                command: GenerationCommand::Cancel { kill_backend, .. },
            } => {
                assert!(kill_backend);
            }
            _ => panic!("expected Generation::Cancel"),
        }
    }

    // -----------------------------------------------------------------------
    // Leaf commands
    // -----------------------------------------------------------------------

    #[test]
    fn parse_list_default_limit() {
        let cli = Cli::try_parse_from(["openloop", "list"]).unwrap();
        match cli.command {
            Commands::List(args) => assert_eq!(args.limit, 20),
            _ => panic!("expected List"),
        }
    }

    #[test]
    fn parse_list_custom_limit() {
        let cli = Cli::try_parse_from(["openloop", "list", "--limit", "50"]).unwrap();
        match cli.command {
            Commands::List(args) => assert_eq!(args.limit, 50),
            _ => panic!("expected List"),
        }
    }

    #[test]
    fn parse_delete_with_id() {
        let cli = Cli::try_parse_from(["openloop", "delete", "a1b2c3"]).unwrap();
        match cli.command {
            Commands::Delete(args) => assert_eq!(args.id, "a1b2c3"),
            _ => panic!("expected Delete"),
        }
    }

    #[test]
    fn parse_clear() {
        let cli = Cli::try_parse_from(["openloop", "clear"]).unwrap();
        match cli.command {
            Commands::Clear(args) => assert!(!args.yes),
            _ => panic!("expected Clear"),
        }
    }

    #[test]
    fn parse_clear_with_yes() {
        let cli = Cli::try_parse_from(["openloop", "clear", "--yes"]).unwrap();
        match cli.command {
            Commands::Clear(args) => assert!(args.yes),
            _ => panic!("expected Clear"),
        }
    }

    #[test]
    fn parse_ps() {
        let cli = Cli::try_parse_from(["openloop", "ps"]).unwrap();
        assert!(matches!(cli.command, Commands::Ps));
    }

    #[test]
    fn parse_stop_no_args() {
        let cli = Cli::try_parse_from(["openloop", "stop"]).unwrap();
        match cli.command {
            Commands::Stop(args) => {
                assert!(args.generation_id.is_none());
                assert!(!args.kill_backend);
            }
            _ => panic!("expected Stop"),
        }
    }

    #[test]
    fn parse_stop_with_id_and_kill_backend() {
        let cli = Cli::try_parse_from(["openloop", "stop", "abc", "--kill-backend"]).unwrap();
        match cli.command {
            Commands::Stop(args) => {
                assert_eq!(args.generation_id.as_deref(), Some("abc"));
                assert!(args.kill_backend);
            }
            _ => panic!("expected Stop"),
        }
    }

    #[test]
    fn parse_pull_pro() {
        let cli = Cli::try_parse_from(["openloop", "pull", "pro"]).unwrap();
        match cli.command {
            Commands::Pull(args) => {
                assert!(matches!(args.model, ModelVariantArg::Pro));
                assert!(args.mirror.is_empty());
            }
            _ => panic!("expected Pull"),
        }
    }

    #[test]
    fn parse_pull_with_mirror() {
        let cli = Cli::try_parse_from([
            "openloop",
            "pull",
            "lite",
            "--mirror",
            "https://mirror.example.com",
        ])
        .unwrap();
        match cli.command {
            Commands::Pull(args) => {
                assert!(matches!(args.model, ModelVariantArg::Lite));
                assert_eq!(args.mirror, vec!["https://mirror.example.com".to_owned()]);
            }
            _ => panic!("expected Pull"),
        }
    }

    #[test]
    fn parse_status() {
        let cli = Cli::try_parse_from(["openloop", "status"]).unwrap();
        assert!(matches!(cli.command, Commands::Status));
    }

    #[test]
    fn parse_doctor() {
        let cli = Cli::try_parse_from(["openloop", "doctor"]).unwrap();
        assert!(matches!(cli.command, Commands::Doctor));
    }

    // -----------------------------------------------------------------------
    // Files
    // -----------------------------------------------------------------------

    #[test]
    fn parse_files_reveal() {
        let cli = Cli::try_parse_from(["openloop", "files", "reveal", "/tmp/test.wav"]).unwrap();
        match cli.command {
            Commands::Files {
                command: FilesCommand::Reveal { path },
            } => {
                assert_eq!(path, "/tmp/test.wav");
            }
            _ => panic!("expected Files::Reveal"),
        }
    }

    #[test]
    fn parse_files_copy() {
        let cli = Cli::try_parse_from(["openloop", "files", "copy", "src.wav", "dst.wav"]).unwrap();
        match cli.command {
            Commands::Files {
                command: FilesCommand::Copy { src, dst },
            } => {
                assert_eq!(src, "src.wav");
                assert_eq!(dst, "dst.wav");
            }
            _ => panic!("expected Files::Copy"),
        }
    }

    #[test]
    fn parse_files_read_audio_with_output() {
        let cli =
            Cli::try_parse_from(["openloop", "files", "read-audio", "abc123", "--output", "-"])
                .unwrap();
        match cli.command {
            Commands::Files {
                command: FilesCommand::ReadAudio { id, output },
            } => {
                assert_eq!(id, "abc123");
                assert_eq!(output.as_deref(), Some("-"));
            }
            _ => panic!("expected Files::ReadAudio"),
        }
    }

    #[test]
    fn parse_files_unlink_with_keep_record() {
        let cli = Cli::try_parse_from(["openloop", "files", "unlink", "abc123", "--keep-record"])
            .unwrap();
        match cli.command {
            Commands::Files {
                command: FilesCommand::Unlink { id, keep_record },
            } => {
                assert_eq!(id, "abc123");
                assert!(keep_record);
            }
            _ => panic!("expected Files::Unlink"),
        }
    }

    // -----------------------------------------------------------------------
    // Setup
    // -----------------------------------------------------------------------

    #[test]
    fn parse_setup_no_args() {
        let cli = Cli::try_parse_from(["openloop", "setup"]).unwrap();
        match cli.command {
            Commands::Setup(args) => {
                assert!(args.key.is_none());
                assert!(args.value.is_none());
                assert!(args.model.is_none());
            }
            _ => panic!("expected Setup"),
        }
    }

    #[test]
    fn parse_setup_key_value() {
        let cli = Cli::try_parse_from(["openloop", "setup", "model", "pro"]).unwrap();
        match cli.command {
            Commands::Setup(args) => {
                assert_eq!(args.key.as_deref(), Some("model"));
                assert_eq!(args.value.as_deref(), Some("pro"));
            }
            _ => panic!("expected Setup"),
        }
    }

    #[test]
    fn parse_setup_flags() {
        let cli =
            Cli::try_parse_from(["openloop", "setup", "--model", "turbo", "--duration", "60"])
                .unwrap();
        match cli.command {
            Commands::Setup(args) => {
                assert_eq!(args.model.as_deref(), Some("turbo"));
                assert_eq!(args.duration, Some(60.0));
            }
            _ => panic!("expected Setup"),
        }
    }

    // -----------------------------------------------------------------------
    // ModelVariantArg -> ModelVariant conversion
    // -----------------------------------------------------------------------

    #[test]
    fn model_variant_arg_converts_to_model_variant() {
        assert_eq!(
            ModelVariant::from(ModelVariantArg::Lite),
            ModelVariant::Lite
        );
        assert_eq!(
            ModelVariant::from(ModelVariantArg::Turbo),
            ModelVariant::Turbo
        );
        assert_eq!(ModelVariant::from(ModelVariantArg::Pro), ModelVariant::Pro);
    }
}
