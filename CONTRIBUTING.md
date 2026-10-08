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

## License and CLA

The project is distributed under [AGPL-3.0-only](LICENSE). Before an external
contribution is merged, its contributor must sign [CLA version 1.0](https://github.com/thedavidweng/OpenLoop/blob/e63bda294370bbb27cc854934cc2607acc17441b/CLA.md).
The bot links the agreement and asks you to post this comment in the PR:

> I have read the CLA Document and I hereby sign the CLA

Use your own GitHub account. No external login, OAuth authorization, or
maintainer approval comment is required. A recorded signature is reused for
future contributions to this project under the same agreement version.
Comment `recheck` to refresh a check after correcting contributor identity.

Contributors retain copyright. The CLA grants David Weng rights to distribute
accepted contributions under other open-source, commercial, and proprietary
terms, including closed-source paid or mobile editions. Users of an AGPL
release do not need to sign a CLA.

See [LICENSING.md](LICENSING.md) for historical grants and third-party licenses.

### Maintainer setup

Publish `cla-signatures` before publishing this workflow. This separate,
unprotected branch contains the versioned agreement and the signature JSON;
records start empty. Require the **`CLA` commit status** from GitHub Actions
(app ID 15368) in the default branch's protection after the workflow is live.
Do not require `CLA Assistant`: comment-triggered runs belong to the default
branch; the `CLA` status explicitly targets the checked PR commit.

Each changed agreement version needs a new pinned document URL and a new
signature-file path. Do not treat existing version 1 signatures as consent to
a changed agreement. Historical contributions are not automatically signed.

The workflow never checks out or executes PR code. The upstream action is
pinned to Vapourfly's version 2.6.1, whose repository is now archived. It checks
at most 100 commits, reads the first page of PR comments, and does not parse
coauthor trailers. An external PR opener must also be a GitHub-linked commit
author; mismatched identity fails the check. Split larger PRs, sign before the
thread grows long, and
verify any additional coauthors' acceptance during the normal rights review.
A bot exemption is not evidence of ownership; third-party and employer rights
still need to be respected.
