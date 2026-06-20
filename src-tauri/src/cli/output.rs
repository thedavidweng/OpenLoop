use std::io::IsTerminal;

use super::events;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputMode {
    Json,
    Human,
}

pub struct Output {
    mode: OutputMode,
    is_tty: bool,
}

impl Output {
    pub fn new(mode: OutputMode) -> Self {
        Self {
            mode,
            is_tty: std::io::stdout().is_terminal(),
        }
    }

    pub fn mode(&self) -> OutputMode {
        self.mode
    }

    pub fn is_json(&self) -> bool {
        self.mode == OutputMode::Json
    }

    /// Print a data line — JSON mode emits raw NDJSON, human mode prints the line.
    pub fn data(&self, json_line: &str, human_line: &str) {
        match self.mode {
            OutputMode::Json => println!("{json_line}"),
            OutputMode::Human => println!("{human_line}"),
        }
    }

    /// Print a success message.
    pub fn success(&self, message: &str) {
        match self.mode {
            OutputMode::Json => {} // success is implicit in JSON mode
            OutputMode::Human => events::human_success(message),
        }
    }

    /// Print an error message (always to stderr).
    pub fn error(&self, message: &str) {
        events::human_error(message);
    }

    /// Print a progress message.
    pub fn progress(&self, label: &str, detail: Option<&str>) {
        match self.mode {
            OutputMode::Json => {} // progress is emitted as events in JSON mode
            OutputMode::Human => events::human_progress(label, detail),
        }
    }

    /// Print an info message.
    pub fn info(&self, message: &str) {
        match self.mode {
            OutputMode::Json => {}
            OutputMode::Human => events::human_info(message),
        }
    }

    /// Print a warning message.
    pub fn warn(&self, message: &str) {
        match self.mode {
            OutputMode::Json => {}
            OutputMode::Human => events::human_warn(message),
        }
    }

    /// Emit a raw JSON line to stdout.
    pub fn emit_json(&self, json: &str) {
        println!("{json}");
    }

    /// Whether stdout is a TTY (for carriage-return progress).
    pub fn is_tty(&self) -> bool {
        self.is_tty
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn output_mode_json_reports_correctly() {
        let out = Output::new(OutputMode::Json);
        assert!(out.is_json());
        assert_eq!(out.mode(), OutputMode::Json);
    }

    #[test]
    fn output_mode_human_reports_correctly() {
        let out = Output::new(OutputMode::Human);
        assert!(!out.is_json());
        assert_eq!(out.mode(), OutputMode::Human);
    }

    #[test]
    fn output_mode_equality() {
        assert_eq!(OutputMode::Json, OutputMode::Json);
        assert_eq!(OutputMode::Human, OutputMode::Human);
        assert_ne!(OutputMode::Json, OutputMode::Human);
    }
}
