# Contributing

Thanks for your interest in contributing.

## Getting Started

```bash
git clone https://github.com/thedavidweng/OpenLoop.git
cd OpenLoop
mise install  # install tools pinned in mise.toml
pnpm install
```

## Development

The native macOS replacement lives in `native/`; see `native/README.md` for its
architecture, runtime setup and migration boundary. The SwiftUI app awaits the
Apple Silicon product smoke matrix before the Tauri app is retired.

```bash
swift build --package-path native -Xswiftc -warnings-as-errors
swift test --package-path native -Xswiftc -warnings-as-errors
swift run --package-path native openloop-cli help
```

The following commands apply to the legacy app retained until native parity:

```bash
# Start dev server (hot-reload)
pnpm tauri dev

# Build release binary
pnpm tauri build

# Run Rust linter
cargo clippy

# Format code
cargo fmt

# Run tests
cargo test
```

## Pull Requests

1. Fork the repository and create a feature branch.
2. Make your changes with tests if applicable.
3. Run `cargo clippy` and `cargo fmt` before committing.
4. Open a pull request against `main`.

## Commit Messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `chore:` maintenance task
- `refactor:` code change that neither fixes a bug nor adds a feature
- `test:` adding or updating tests

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
