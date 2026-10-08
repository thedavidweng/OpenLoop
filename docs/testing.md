# OpenLoop Testing Guide

## Native macOS acceptance — 2026-10-07

**Decision: visual checks passed for the inspected states; native release is not approved.**
Baseline commit `586d8a5`, followed by the local release fixes described below, tested on Apple Silicon, 16 GB memory, macOS 27.0.1.
The release app was built into `/tmp/openloop-acceptance-20261007/OpenLoop.app`
with its own `OPENLOOP_DATA_DIR`. The fixed candidate is
`/tmp/openloop-final-20261007/OpenLoop.app`; its DMG was mounted
read-only and copied to `/tmp/openloop-final-installed-20261007/OpenLoop.app`. The existing user library was not used for
the interaction tests. Screenshots are native window captures, not browser
mockups; see the READMEs. Main-window captures are 2320 × 1304 Retina pixels
(1160 × 652 points, the configured minimum width).

| Check | Result | Evidence / boundary |
| --- | --- | --- |
| Native compilation | PASS | `swift build --package-path native -Xswiftc -warnings-as-errors` |
| Core, adapter, CLI, audio and presentation tests | PASS | `swift test --package-path native`: 22 core tests and 11 app tests |
| Release packaging | PASS | `python3 native/scripts/package-app.py --uv src-tauri/binaries/uv-aarch64-apple-darwin --output /tmp/openloop-acceptance-20261007/OpenLoop.app` |
| Packaged CLI smoke | PASS | Existing `smoke-cli.py`, pointed at the fresh bundle: project/settings persistence, NDJSON v2, deletion without confirmation rejected, SIGINT exit 130, persisted cancellation, resources and uv present |
| First-run workspace and setup | PASS | Empty states, disabled empty-prompt generation, nonempty-prompt generation routes to setup, compatibility/memory/download/license text, Install disabled before review, Not Now dismisses |
| Settings | PASS | General, Models and Advanced inspected; duration changed from 30 to 35 seconds via GUI, persisted to CLI and applied to new Compose after relaunch; announced model unavailable; Settings Install opens setup |
| Project and GUI/CLI shared state | PASS | GUI created Midnight Sketches; CLI produced two Takes through local HTTP fixture; both appeared in GUI without relaunch |
| Take inspector and transport | PASS | Selection loads a 10-second WAV and waveform; Play/Pause state changes; adjustable waveform seeks to 0:05; A/B picker and Shift-Command-B switch loaded Take; reproduction loads recorded prompt, model, duration and seed 43 |
| History | PASS | Empty state, completed rows, favorite toggle, favorites filter, no-results search, clearing search, inspector hiding; all columns visible with inspector hidden |
| Export | PASS | Command-E opens native Save panel; exported WAV in the isolated directory is byte-identical to source (SHA-256 `5dd10f6699da11b1d9a0e1bf039d94c8ddf6e858d3f143d853ae8335f01e3a33`) |
| Deletion confirmation | PASS | Command-Delete states record and Artifact deletion is irreversible; Cancel preserves both Takes; actual deletion covered by automated tests |
| Light/dark layout and relaunch | PASS | Inspected empty/populated workspace, History, setup and settings in dark appearance, empty/populated workspace in light appearance; columns and pinned transport fit; project, Takes, favorite and saved default retained after packaged relaunch |
| Bundle signature | PASS | Original resource-seal failure fixed by signing nested CLI/uv before the complete app. Strict deep verification passes on the app and DMG installation copy; modifying a bundled manifest invalidates the seal. Ad-hoc signing is not Developer ID signing or notarization |
| Native release workflow | PASS (local validation) | Replaced Tauri publishing with native compile/tests, signed bundle/DMG, packaged smoke and draft release. `actionlint` and offline `zizmor` pass. No remote release was triggered or published |
| Real-model installation | PASS | Isolated `/tmp/openloop-real-acceptance-20261007`: official pinned runtime provisioned with bundled uv and the complete Standard pack installed after explicit CLI license acceptance. Manifest now includes backend-required base checkpoints; Standard 11.46 GB, XL 30.05 GB. Python model code comes from the pinned runtime |
| Real-model inference | PASS (Lite) | Installed Standard pack, MLX 0.31.1, duration 10 and seed 42, with `HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1`. Generated 48 kHz stereo WAV: 480,000 frames, finite samples, RMS 0.15148, peak 0.89127. Export is byte-identical; owned backend exited with CLI. Turbo/XL and real Repaint are not covered |
| Remaining hardware/distribution acceptance | NOT VERIFIED | Auditory quality, real Repaint submission, Finder/DAW drag, notifications, VoiceOver, macOS 15 minimum-OS behavior, clean-machine/quarantined DMG install, notarization/Gatekeeper, and legacy/native coexistence |

### Release fixes and reproducible checks

Fixed native runtime eager loading (`ACESTEP_NO_INIT=false`), the startup
`checkpoints` link to the installed model directory, and readiness inventory
(`GET /v1/model_inventory`). The pinned backend registers an OpenRouter list at
`/v1/models`, which does not include loading state. The fixture now follows the
actual inventory endpoint. Model Python files are excluded from downloads and
integrity-size checks because the pinned runtime synchronizes them on loading.
Lite requests now disable format/CoT features together with Planning, instead
of requiring a language model that Lite does not load. Turning Planning on for
Lite is rejected by the adapter; the UI hides that unavailable control and
clears its override when switching configuration. CLI exit stops its owned
runtime, and PATH symlinks resolve to the bundle's uv. Reproduction links the new task to the
surviving source Take, so a retained variation remains reproducible after its
parent is deleted. Runtime memory metadata describes a recommendation, not an
enforced minimum.

The signed DMG installation copy was relaunched against the isolated fixture
library: project, both Takes and favorite state persisted. Native waveform drag
selected 1.51–7.38 seconds; loop state turned on and playback remained active.
Repaint loaded that region, source WAV and recorded prompt into Compose. These
checks verify interaction and request construction, not real Repaint output.
Final Models/setup screenshots show the corrected download sizes and 24 GB
memory recommendation. The last DMG installation copy was relaunched with the
real-generation library: History displayed the generated 10-second Take and seed
42, double-click loaded its waveform and advanced playback position, and playback
returned to idle at the end. Reproduce restored the prompt, duration and seed 42
in Compose. Expanded Lite advanced settings correctly omit Planning. The History
screenshot now shows that real Take; workspace screenshots retain synthetic audio.

```sh
swift build --package-path native -Xswiftc -warnings-as-errors
swift test --package-path native -Xswiftc -warnings-as-errors
python3 native/scripts/package-app.py --uv src-tauri/binaries/uv-aarch64-apple-darwin \
  --output /tmp/openloop-candidate/OpenLoop.app \
  --dmg /tmp/openloop-candidate/OpenLoop_0.2.1_aarch64.dmg
python3 native/scripts/smoke-cli.py --bundle /tmp/openloop-candidate/OpenLoop.app
node scripts/validate-readme.mjs
node scripts/validate-release-notes.mjs
actionlint .github/workflows/ci.yml .github/workflows/release.yml
zizmor --offline .github/workflows/release.yml
```

The first real diffusion attempt exposed MLX 0.32.3's cross-thread stream
failure. The backend attempted to fall back to PyTorch; that run was cancelled
and is not a passing MLX result. Runtime setup/startup now constrains MLX to
0.31.1 using uv project constraints. See the [upstream root cause](https://github.com/ml-explore/mlx-lm/issues/1181)
and [uv constraint documentation](https://docs.astral.sh/uv/reference/settings/#constraint-dependencies).
Both the failed attempt and MLX-pinned rerun peaked at 20.7 GB physical footprint on this 16 GB Mac;
low-memory performance is not accepted based on a memory recommendation alone.
The native catalog now recommends 24 GB instead of the unverified 8/16 GB
recommendations. More memory is a recommendation, not a tested performance guarantee.

The pinned MLX rerun completed successfully in about 13 minutes 20 seconds,
including cold model loading; the backend reported 451.11 seconds for generation.
Generation `84FEAAD1-2CFD-4574-A3B2-C3693E67BF36` recorded seed 42 and a
10-second WAV. Its source and exported copy both have SHA-256
`42af987a377e46b0118bf717c30ed6c1afda894fdb691ad8041696a02c17c835`.
These checks establish real inference and file integrity, not listening quality
or acceptable interactive latency on a 16 GB machine.

The remaining hardware/distribution checks above remain publication gates.
No Developer ID certificate/notarization credentials are configured here.
Screenshots demonstrate inspected UI states, not release certification.

## Retiring implementation checks

Legacy frontend/Rust tests remain useful for migration comparisons and still run
in CI. They are not release packaging commands:

```sh
pnpm typecheck
pnpm test:run
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
```

`pnpm release:check` now runs the native compile/tests and documentation gates.
`pnpm release:build` prepares uv, packages the signed native app and
`native/dist/OpenLoop.dmg`, and runs packaged smoke. Existing outputs are never
overwritten; remove a previous local candidate explicitly before rebuilding.
