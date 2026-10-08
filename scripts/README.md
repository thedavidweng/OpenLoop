# Scripts

Repository automation scripts. Each entry lists purpose, input, output, how to
run it, and when to run it.

## `sync-version.mjs`

Propagates the `package.json` version to the Rust and Tauri manifests so a
single source of truth drives every build artifact.

- **Input:** `version` in `package.json`
- **Output:** rewrites `version` in `src-tauri/Cargo.toml`, the `openloop`
  package entry in `src-tauri/Cargo.lock`, and `version` in
  `src-tauri/tauri.conf.json` when they differ
- **Run:** `node scripts/sync-version.mjs` or `pnpm version:sync`
- **When to run:** automatically before `pnpm dev`, `pnpm build`, and
  `pnpm tauri` (each prefixes `pnpm version:sync`); run it directly after a
  version bump
- **Idempotent:** a second run reports `Version already synced` and writes
  nothing

## `prepare-sidecars.mjs`

Downloads and stages the `uv` sidecar binaries that the Python backend needs at
runtime.

- **Input:** none (pins `uv` version via `OPENLOOP_UV_VERSION`, default
  `0.11.7`)
- **Output:** verified `uv` binaries under `src-tauri/binaries/`, with archive
  downloads cached in `src-tauri/binaries/.cache`
- **Run:** `node scripts/prepare-sidecars.mjs` or `pnpm prepare:sidecars`
- **When to run:** before a Tauri build or Rust test that needs the sidecar;
  CI runs it before `cargo check`
- **Failure:** exits non-zero if a download or checksum verification fails

## `check-patch-coverage.mjs`

Computes patch coverage for the current branch, mirroring the Codecov `patch`
status check in `codecov.yml` (target 80%).

- **Input:** the git diff against the merge-base of `--base` (default `main`);
  runs `vitest --coverage` unless `--skip-run` reuses `coverage/lcov.info`
- **Output:** a per-file coverage report on stdout; no files written
- **Run:** `node scripts/check-patch-coverage.mjs [--base <branch>] [--threshold <n>] [--skip-run]`
  or `pnpm coverage:patch`
- **When to run:** before pushing a feature branch; the lefthook `pre-push`
  hook runs it and skips on `main`/`master`
- **Exit codes:** `0` meets threshold, `1` below threshold, `2` no diff lines
  in tracked source files

## `i18n-audit.mjs`

Compares the locale key sets between `en.json` and `zh-CN.json`.

- **Input:** `src/locales/en.json` and `src/locales/zh-CN.json`
- **Output:** a list of keys present in `en.json` but missing in `zh-CN.json`
- **Run:** `node scripts/i18n-audit.mjs` or `pnpm i18n:audit`
- **When to run:** after adding or renaming locale keys
- **Exit codes:** `0` all keys match, `1` missing keys found

## `validate-readme.mjs`

Validates `README.md` and `README_CN.md` for license and status consistency
(Apache-2.0 badges, status line, Tauri v2 CSP reference).

- **Input:** `README.md`, `README_CN.md`, and the CSP ADR
- **Output:** a pass/fail report on stdout
- **Run:** `node scripts/validate-readme.mjs` or `pnpm validate:readme`
- **When to run:** after editing the READMEs or the license/status metadata
- **Exit codes:** `0` all checks pass, `1` one or more checks fail

## `validate-release-notes.mjs`

Checks that DMG release notes document the Gatekeeper bypass (right-click Open,
`xattr -cr`) and a Homebrew alternative.

- **Input:** Markdown files under `docs/release-notes/`
- **Output:** a pass/fail report on stdout
- **Run:** `node scripts/validate-release-notes.mjs` or
  `pnpm validate:release-notes`
- **When to run:** after editing release notes
- **Exit codes:** `0` all checked notes pass, `1` one or more checks fail

## `generate-macos-liquid-glass-icon.mjs`

Compiles the Icon Composer project into macOS 26 Liquid Glass assets.

- **Input:** `src-tauri/icons/OpenLoop.icon/` (already carries its composed
  layers and background fill, so no foreground layer is extracted)
- **Prerequisites:** macOS host with Xcode `actool` (`xcrun actool`)
- **Output:** `src-tauri/icons/Assets.car` and `src-tauri/icons/OpenLoop.icns`
- **Run:** `node scripts/generate-macos-liquid-glass-icon.mjs`
- **When to run:** after changing `OpenLoop.icon/icon.json` or its layer assets
- **Non-macOS hosts:** exits `0` without writing files
- **Missing `actool`:** warns and exits `0` so hosts without full Xcode do not
  fail the build
- **Bundling:** wire `Assets.car` into the app via `tauri.conf.json`
  `bundle.resources` (owned outside this script)

## `screenshot.mjs`

Captures a Playwright screenshot of the running dev app for documentation and
manual UI inspection.

- **Input:** a dev server on `http://localhost:1420` (start `pnpm dev` first)
- **Output:** `docs/screenshots/01-initial.png` plus diagnostic logging of the
  page title, visible buttons, and inputs
- **Run:** `node scripts/screenshot.mjs`
- **When to run:** ad hoc, to refresh documentation screenshots or inspect the
  rendered UI

## Native migration tools

- Native documentation screenshots are captured with the `unified-computer-use`
  plugin's `cua_repl`: `app.getScreenshot({ emit: false })`, saved without image
  edits using Node's `fs.writeFile`. Outputs are
  `docs/screenshots/native-{workspace,workspace-light,history,models,setup}.jpg`,
  embedded in both READMEs. The October 7, 2026 captures use an isolated library
  for workspace captures with synthetic WAV responses from a temporary variant of
  `native/Tests/OpenLoopCoreTests/Fixtures/ace-server.py`. The History capture shows
  the real Lite generation (10 seconds, seed 42). Final Models/setup captures show
  Standard 11.46 GB, XL 30.05 GB and 24 GB memory recommendations. Capture the packaged
  native app, not the legacy browser preview. Light appearance was selected only
  for the test process with `-NSRequiresAquaSystemAppearance YES`.
- `native/scripts/import-model-manifest.py` imports the retiring Rust file list into
  `native/Sources/OpenLoopEngines/Resources/model-files.json`. This is a migration
  generator, not a build-time dependency. It includes the pinned API
  base-checkpoint requirements and excludes Python files synchronized from the
  pinned runtime. The native manifest becomes authoritative
  when the legacy stack is retired; remove the importer in that retirement change.
- `native/scripts/package-app.py --uv PATH` builds an ad-hoc signed Apple Silicon
  `native/dist/OpenLoop.app`, including the Swift CLI, model resource bundle,
  existing icon, and verified uv sidecar. It generates `Contents/Info.plist` from
  the root package version. It signs nested executables before sealing the app
  and verifies the result. `--sign IDENTITY` selects Developer ID signing;
  `--dmg PATH` generates an installable DMG containing an Applications shortcut.
  Existing outputs must be removed explicitly.
  `pnpm release:build` selects `native/dist/OpenLoop.dmg` for local builds; the
  GitHub workflow names the DMG using package.json version and architecture.
- `native/scripts/smoke-cli.py` accepts `--bundle PATH`, verifies app/helper signatures and bundled uv
  execution, then exercises that packaged CLI against a temporary
  local HTTP fixture, including SIGINT exit status and persisted cancellation.
  It writes no repository artifacts and does not download or run real models.

## Generated changelog

`pnpm changelog` runs `git-cliff` with `cliff.toml` and writes `CHANGELOG.md`
from Conventional Commits. Regenerate it after commits; do not edit the output
by hand.
