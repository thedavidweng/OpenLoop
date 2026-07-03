use clap::Command;
use clap_complete::{generate, Shell};
use std::io;

pub fn print_completions(shell: Shell, cmd: &mut Command) {
    generate(shell, cmd, "openloop", &mut io::stdout());
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::{CommandFactory, Parser};

    #[derive(Parser)]
    #[command(name = "test")]
    struct TestCli {
        #[command(subcommand)]
        command: Option<TestCmd>,
    }

    #[derive(clap::Subcommand)]
    enum TestCmd {
        Hello,
    }

    #[test]
    fn generates_zsh_completion_without_panic() {
        let mut cmd = TestCli::command();
        let mut buf = Vec::new();
        generate(Shell::Zsh, &mut cmd, "test", &mut buf);
        let output = String::from_utf8(buf).unwrap();
        assert!(output.contains("test"));
    }

    #[test]
    fn generates_bash_completion_without_panic() {
        let mut cmd = TestCli::command();
        let mut buf = Vec::new();
        generate(Shell::Bash, &mut cmd, "test", &mut buf);
        let output = String::from_utf8(buf).unwrap();
        assert!(output.contains("test"));
    }
}
