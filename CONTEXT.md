# OpenLoop Context

OpenLoop is a local-first music generation tool for Apple Silicon. ACE-Step 1.5 is the bound Engine today; additional Engines and Model Packs are registered in a first-party catalog so they can be downloaded and switched without rewriting Settings. It has two interfaces — a desktop GUI and a command-line CLI — that share all state: settings, history, models, and the backend process.

## Language

**Generation Task**:
The lifecycle for one user generation request from validation through backend execution, recovery, cancellation, and completion.

**Generation Record**:
The persisted result of a completed Generation Task.
_Avoid_: History item, output, file

**Output File**:
The local audio file associated with a completed Generation Record.
_Avoid_: Generation Record, history file

**History**:
The local list of generated music outputs.
_Avoid_: Failed attempts, cancelled tasks, backend logs

**Backend Log**:
A diagnostic file written by the Local Backend for troubleshooting.
_Avoid_: History, Generation Record

**Advanced Setting**:
A configuration option intended for users who deliberately open advanced or diagnostic controls.
_Avoid_: Primary workflow, beginner setting

**Engine**:
A generation family with its own Local Backend contract, capability schema, and Model Packs.
_Avoid_: Model, Model Pack, Model Slot

**Model Pack**:
A downloadable (or announced) weight set owned by one Engine. Users install and delete Model Packs, not Engines.
_Avoid_: Engine, Model Slot, Model Variant

**Model Slot**:
A selectable run configuration that points at one Model Pack. One Model Pack may back several Model Slots.
_Avoid_: Engine, Model Pack, Model Variant

**Local Backend**:
The on-device HTTP process for the active Engine. ACE-Step is the only bound Local Backend in the current release.

**Model Bootstrap**:
The local readiness path that decides whether generation can run.

**Runtime Layout**:
The OpenLoop-managed filesystem layout required by the Local Backend.

**Settings**:
Persisted local configuration for Engine and Model Slot selection, runtime directories, backend startup, output defaults, language, and first-run state.

## Relationships

- The CLI and GUI are two interfaces to the same product; a **Generation Task** submitted via the CLI appears in GUI **History**, and vice versa.
- **Settings** changed via the CLI are immediately visible in the GUI, and vice versa.
- The CLI supports agent workflows: it can run headlessly, output machine-readable JSON, and auto-bootstrap the **Local Backend** and **Model Bootstrap** on first use.
- A **Generation Task** produces exactly one **Generation Record** per variation.
- A **Generation Record** has exactly one **Output File** when created.
- A failed **Generation Task** produces no **Generation Record**; the form remains available for correction and retry.
- A failed **Generation Task** may also create a diagnostic `failed_runs` entry for retry/support workflows; this entry is not **History** and is not a **Generation Record**.
- A cancelled **Generation Task** produces no **Generation Record**; the form remains on the submitted settings because generation controls are not editable while running.
- **History** contains generated music outputs: **Generation Records** plus their **Output Files**.
- Playback, audio reads, waveform reads, reveal, export, and file deletion require an **Output File**.
- A **Generation Record** whose **Output File** is missing remains in **History** as a missing-file item until the user deletes the record.
- Clearing **History** removes **Generation Records** and their **Output Files**.
- **History** cleanup is a normal user-facing action, similar to clearing search history.
- **History** cleanup supports deleting one generated output or clearing all generated outputs.
- Clearing all **History** must tell users it deletes records and local audio files, show the affected count, and require confirmation.
- Deleting one generated output must require confirmation because it deletes the local audio file.
- Missing-file items can be cleared by deleting their **Generation Record** when no **Output File** remains.
- **Backend Logs** are diagnostic artifacts with automatic retention, not user-managed history.
- **Model Bootstrap** represents whether local generation is ready, not only whether a model is downloading.
- **Model Bootstrap** includes the selected **Model Slot**, its **Model Pack**, **Runtime Layout**, and **Local Backend** health.
- **Runtime Layout** may repair OpenLoop-managed links, but must not silently reorganize unknown user-owned files.
- **Settings** that affect **Local Backend** startup are `backendPort`, `modelDirectory`, `backendWorkingDirectory`, `logDirectory`, `modelVariant`, and `selectedModelId`.
- Backend-impacting **Settings** changes should tell users they affect the next **Local Backend** start; v1 does not automatically restart the backend.
- `modelDirectory` means OpenLoop-managed model storage, not an arbitrary ACE-Step project directory.
- The first-party catalog is the only place new **Engines**, **Model Packs**, and **Model Slots** are registered. Commands, the CLI, and the Settings UI must not hard-code family names when listing or switching.
- An **Engine** without a bound **Local Backend** may appear in the catalog so a future pack (for example MiniMax Music 3 Turbo) can attach later. It must not run a **Generation Task**.
- `modelVariant` is the ACE-Step **Model Slot** alias (`lite` / `turbo` / `pro`). `selectedModelId` is the canonical **Model Slot** id (`ace-step/turbo`, `minimax-music3/turbo`). When both are set, `selectedModelId` wins.
- OpenLoop uses its bundled `uv` sidecar for the **Local Backend**; legacy external backend command settings are pruned, not migrated.
- User-facing screens should present simple **Generation Task**, **History**, and **Settings** language; implementation details belong in **Advanced Settings** or diagnostics.
- **Advanced Settings** are opt-in; beginner workflows should work without understanding **Runtime Layout**, sidecars, IPC commands, or backend internals.
- **History** UI should read as generated music history, not as a technical run log.
- Failed **Generation Tasks** should present a clear retry path with optional technical details, not a **History** item.
- `failed_runs` is a bounded diagnostic archive for recent failed **Generation Tasks**. It supports retry, opening the failed request in the form, and copying diagnostics, but it must not be displayed as generated music **History**.

## Example Dialogue

> **Dev:** "When the user clears **History**, should we delete the generated WAV files too?"
> **Domain expert:** "Yes. **History** is the list of generated music outputs, so clearing it removes both records and their **Output Files**."

> **Dev:** "Should **History** cleanup include time ranges or current search results?"
> **Domain expert:** "No. Users need single-output deletion and clear-all history cleanup."

> **Dev:** "Can `clear_generation_history` silently delete output files because the command name is stable?"
> **Domain expert:** "No. The compatible IPC name can stay, but the UI must make the destructive file deletion explicit before running it."

## Flagged Ambiguities

- "History" was previously used to mean both generated outputs and failed attempts; resolved: **History** is generated music outputs only.
- "Cancelled" was previously treated like a **Generation Record** status; resolved: user cancellation is not part of **History**.
- "Failed" was previously treated like a **Generation Record** status; resolved: backend failure is a run outcome, not a **History** item.
- "Log" was used while discussing **History** growth; resolved: **Backend Logs** and **History** are separate growth sources with different retention rules.
