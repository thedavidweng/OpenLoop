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

The app and CLI live in `native/` and share OpenLoopCore. See
[native/README.md](native/README.md) for architecture and runtime setup.

```bash
swift build --package-path native -Xswiftc -warnings-as-errors
swift test --package-path native -Xswiftc -warnings-as-errors
swift run --package-path native openloop-cli help
pnpm release:check
```

Node/pnpm are repository tooling only; no React, Tauri, or Rust app is built.
The root `package.json` version drives the native bundle version.

## Pull Requests

1. Fork the repository and create a feature branch.
2. Make your changes with tests if applicable.
3. Run `pnpm release:check` and `pnpm format:check` before committing.
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

CLA v1 signatures are append-only GitHub Actions bot comments on the licensing
PR [#262](https://github.com/thedavidweng/OpenLoop/pull/262). No signature branch
or direct write to protected `main` is required. Keep that PR's discussion
unlocked and retain its registration comments. The former signature JSON was
empty when this storage migration was made.

Require the **`CLA` commit status** from GitHub Actions (app ID 15368) in main's
protection after activation. Do not require `CLA Assistant`: comment-triggered
runs belong to main, while `CLA` targets the actual checked PR commit.
This requirement still needs repository administration access to configure;
the workflow alone does not enforce merge protection.

Each changed agreement version needs a new pinned document URL and a new
signature-record marker. Do not treat existing version 1 signatures as consent to
a changed agreement. Historical contributions are not automatically signed.

The workflow checks out only its trusted base/default-branch revision and never
executes PR code. It checks all linked commit authors and paginates commits and
signature comments. Unlinked identities fail explicitly. Registration requires
an exact consent comment after the versioned bot prompt and is read back before
publishing success. A prior grant covers the signing PR and PRs submitted after
signing. A stale PR head fails the checked commit's status.

Coauthor trailers still require manual rights review. Maintainer and explicitly
allowlisted bot exemptions are not evidence of third-party or employer rights.
