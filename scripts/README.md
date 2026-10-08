# Scripts

Repository automation scripts. Each entry lists purpose, input, output, how to
run it, and when to run it.

## `prepare-sidecars.mjs`

Downloads and stages the `uv` sidecar binaries that the Python backend needs at
runtime.

- **Input:** none (pins `uv` version via `OPENLOOP_UV_VERSION`, default
  `0.11.7`)
- **Output:** verified `uv` binaries under `native/binaries/`, with archive
  downloads cached in `native/binaries/.cache`
- **Run:** `node scripts/prepare-sidecars.mjs` or `pnpm prepare:sidecars`
- **When to run:** before native packaging; CI and release workflows verify the sidecar
- **Failure:** exits non-zero if a download or checksum verification fails

## `validate-readme.mjs`

Validates `README.md` and `README_CN.md` for license and status consistency
(AGPL-3.0-only badges, Alpha status and native architecture).

- **Input:** `README.md`, `README_CN.md`, and the native architecture ADR
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

## Website

The landing page lives in `website/` (Vite + TypeScript, no framework) and
deploys to GitHub Pages at `thedavidweng.github.io/OpenLoop/`.

- **Run:** `pnpm website:dev` for local development, `pnpm website:build` to
  typecheck and build
- **Output:** `website/dist/` (git-ignored)
- **Deploy:** `.github/workflows/pages.yml` builds and publishes on pushes to
  `main` that touch `website/**`. GitHub Pages must use "GitHub Actions" as its
  source.
- **Icons:** `website/public/img/*` are resized from `native/Assets/1024x1024.png`
  with `sips -Z` (256, 180, 96) and `magick -resize 32x32` for `favicon.ico`.
  Regenerate them after the app icon changes.

## Generated changelog

`pnpm changelog` runs `git-cliff` with `cliff.toml` and writes `CHANGELOG.md`
from Conventional Commits. Regenerate it after commits; do not edit the output
by hand.

## `check-cla.cjs`

The CLA workflow runs this script from its trusted base/default-branch revision.
It records versioned signatures as GitHub Actions bot comments on licensing PR
#262 and publishes the `CLA` status on the checked PR head; it generates no
repository files and requires no additional branch. `node scripts/check-cla.test.cjs`
checks identity, forged/wrong-version records, persistence failure, all authors,
stale heads and reuse without sending GitHub messages. Protect main with the
`CLA` status after activation; workflow installation alone is not merge enforcement.

The native catalog resource `native/Sources/OpenLoopEngines/Resources/model-files.json`
is maintained directly. Its one-time Rust importer is retired. Icons live in
`native/Assets/`; the editable Icon Composer source is preserved there.
