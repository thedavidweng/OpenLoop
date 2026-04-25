# OpenLoop Codex Development Plan

**版本**: 1.0  
**目标**: 指导 Coding Agent 从零实现 OpenLoop v0.1 Alpha  
**输入文档**: `OpenLoop_PRD.md`  
**开发模式**: 小步提交、每阶段可运行、优先打通技术闭环  
**目标平台**: macOS Apple Silicon  

---

## 0. 总体执行原则

必须按以下原则开发：

1. 每个阶段都保持应用可启动。
2. 每个任务完成后运行对应测试或手动验证命令。
3. 不引入未经 PRD 批准的云服务、账号系统或遥测。
4. 所有 shell/sidecar 权限采用最小权限。
5. 后端调用优先通过 ACE-Step local HTTP API。
6. 不把完整歌词写入普通日志。
7. 所有用户可见错误必须通过统一 `AppError` 映射。
8. MVP 优先保证 Apple Silicon 本地生成闭环。
9. Intel Mac 仅显示 unsupported/experimental，不作为 v0.1 实现目标。
10. Repaint 默认不实现，只保留后续扩展接口。

---

## 1. 推荐仓库结构

```text
openloop/
  README.md
  LICENSE
  package.json
  pnpm-lock.yaml
  src/
    app/
      App.tsx
      routes/
      components/
        layout/
        generation/
        history/
        player/
        settings/
        common/
      lib/
        api.ts
        types.ts
        validation.ts
        format.ts
        store.ts
    styles/
  src-tauri/
    Cargo.toml
    tauri.conf.json
    capabilities/
      default.json
    src/
      main.rs
      commands/
        mod.rs
        backend.rs
        generation.rs
        history.rs
        settings.rs
        files.rs
      services/
        backend_manager.rs
        ace_client.rs
        db.rs
        file_store.rs
        device.rs
        logger.rs
      models/
        mod.rs
        errors.rs
        generation.rs
        settings.rs
    migrations/
      001_init.sql
    sidecars/
      README.md
  docs/
    OpenLoop_PRD.md
    Development_Plan.md
    architecture.md
    testing.md
```

---

## 2. Phase 0 — Project Bootstrap ✅

### Goal

Create a minimal Tauri v2 + React + TypeScript app that launches on macOS.

### Tasks

1. Initialize project: [x]
   - Vite + React + TypeScript.
   - Tauri v2.
   - Rust workspace configured by Tauri.
2. Add base UI shell: [x]
   - Left history column.
   - Center generation form.
   - Right preview panel.
3. Add TypeScript strict mode. [x]
4. Add Rust formatting/lint scripts. [x]
5. Add README with local dev commands. [x]

### Expected Commands

```bash
pnpm install
pnpm tauri dev
cargo fmt
cargo check
pnpm typecheck
```

### Acceptance Criteria

- `pnpm tauri dev` starts the app.
- UI shows three columns.
- No generation features are required yet.
- TypeScript and Rust compile successfully.

### Suggested Commit

```text
chore: bootstrap tauri react app
```

---

## 3. Phase 1 — Core Types, Validation, and App State ✅

### Goal

Define shared generation types and form validation before backend work.

### Tasks

1. Create `src/app/lib/types.ts`. [x]
2. Define shared types (`GenerationRequest`, etc.). [x]
3. Create validation rules. [x]
4. Add UI disabled/loading states. [x]
5. Add mock/real generation state machine. [x]

### Acceptance Criteria

- Invalid form displays inline errors.
- Generate button disabled for invalid input.
- State machine can handle `idle → validating → running → completed/failed`.
- Validation logic is robust.

### Suggested Commit

```text
feat: add generation form state and validation
```

---

## 4. Phase 2 — SQLite Persistence ✅

### Goal

Add local persistence for settings, generation history, and backend events.

### Tasks

1. Add Tauri SQL plugin or Rust SQLite layer. [x]
2. Create migrations. [x]
3. Implement Rust services (`db.rs`, `settings.rs`, `generation.rs`). [x]
4. Implement Tauri commands for settings and history. [x]
5. Implement frontend history panel. [x]

### Migration SQL

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  prompt TEXT,
  lyrics TEXT,
  vocal_language TEXT,
  duration_seconds REAL,
  bpm INTEGER,
  key_scale TEXT,
  time_signature TEXT,
  model TEXT,
  lm_model TEXT,
  thinking INTEGER,
  inference_steps INTEGER,
  guidance_scale REAL,
  use_random_seed INTEGER,
  seed TEXT,
  audio_format TEXT,
  output_path TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  generation_info TEXT
);

CREATE TABLE IF NOT EXISTS backend_events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  level TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata_json TEXT
);
```

### Acceptance Criteria

- Settings persist across app restarts.
- Mock generation records appear in history.
- History can be searched by prompt/lyrics.
- Deleting a record removes it from SQLite.
- File deletion can be deferred to later phase.

### Suggested Commit

```text
feat: add sqlite settings and generation history
```

---

## 5. Phase 3 — Device and Environment Detection ✅

### Goal

Detect whether the user is on a supported Apple Silicon Mac and store default profile.

### Tasks

1. Add Rust `device.rs`. [x]
2. Detect OS, arch, memory, and CPU. [x]
3. Add setup screen logic based on detection. [x]
4. Select default generation profile (low-memory/standard/quality). [x]

### Acceptance Criteria

- Apple Silicon device receives a supported profile.
- Intel Mac shows unsupported/experimental messaging.
- Device info appears in Settings/About.
- Profile controls default `thinking` and model choices.

### Suggested Commit

```text
feat: add device detection and setup profile
```

---

## 6. Phase 4 — Backend Manager ✅

### Goal

Implement Rust-side backend lifecycle manager for ACE-Step API server.

### Tasks

1. Create `BackendManager`. [x]
2. Add backend settings management. [x]
3. Implement start/stop/status/logs commands. [x]
4. Implement health polling. [x]
5. Capture logs to dated files. [x]
6. Ensure sidecar/shell permissions are minimal. [x]

### BackendStatus

```ts
type BackendStatus =
  | { state: "stopped" }
  | { state: "starting" }
  | { state: "healthy"; port: number }
  | { state: "failed"; error: AppError };
```

### Acceptance Criteria

- User can start and stop backend from Settings.
- Health check succeeds against a real or mock server.
- Failure returns `BACKEND_START_FAILED` or `BACKEND_HEALTH_TIMEOUT`.
- Logs are written to app log directory.
- App exit stops owned backend process.

### Suggested Commit

```text
feat: manage local ace-step backend process
```

---

## 7. Phase 5 — ACE-Step API Client ✅

### Goal

Implement a Rust or TypeScript-facing client for the local ACE-Step API.

### Tasks

1. Implement core API methods (release, query, download). [x]
2. Define request mapping (updated for negative_prompt). [x]
3. Parse and normalize responses. [x]
4. **Achieve Gradio feature parity** (negative_prompt, select-based language). [x]
5. Add unit tests with mocked responses. [x]

### Request Mapping

```json
{
  "prompt": "<prompt>",
  "lyrics": "<lyrics>",
  "vocal_language": "en",
  "audio_duration": 30,
  "bpm": 120,
  "key_scale": "C Major",
  "time_signature": "4",
  "audio_format": "wav",
  "model": "acestep-v15-turbo",
  "thinking": true,
  "inference_steps": 8,
  "guidance_scale": 7.0,
  "use_random_seed": true,
  "seed": -1,
  "batch_size": 1
}
```

### Acceptance Criteria

- Mock API test covers release/query/download.
- Bad response maps to `TASK_SUBMIT_FAILED`.
- Failed task maps to `TASK_FAILED`.
- Downloaded audio bytes can be written to temp path.
- Model list can be displayed in Settings.

### Suggested Commit

```text
feat: add ace-step api client
```

---

## 8. Phase 6 — Real Generation Flow ✅

### Goal

Connect UI → Tauri → backend → ACE-Step → local file → player.

### Tasks

1. Add Tauri command `generate_music`. [x]
2. Implement polling and download flow. [x]
3. Add cancellation support. [x]
4. Emit progress events to UI. [x]
5. Handle history creation and output directory saving. [x]

### Tauri Event Stream

Emit events:

```ts
type GenerationEvent =
  | { type: "backend_starting" }
  | { type: "submitted"; taskId: string }
  | { type: "queued" }
  | { type: "running" }
  | { type: "downloading" }
  | { type: "completed"; generationId: string; outputPath: string }
  | { type: "failed"; error: AppError };
```

### Acceptance Criteria

- A 10-second generation produces an audio file.
- The audio file is copied into output directory.
- UI loads and plays generated file.
- History row is created.
- Failure preserves form input.
- Cancel stops UI polling and changes state to cancelled.

### Suggested Commit

```text
feat: implement text-to-music generation flow
```

---

## 9. Phase 7 — Player and File Handling 🔄

### Goal

Implement local playback, reveal in Finder, and export behavior.

### Tasks

1. Implement player component. [x]
2. Implement file commands (reveal, copy, exists). [x]
3. Add missing-file handling. [x]
4. Add export directory setting. [x]
5. Add waveform visualization. [ ] (Planned for v0.2)

### Acceptance Criteria

- Current audio plays in preview.
- History item loads audio into player.
- Missing file shows clear state.
- Reveal in Finder works for existing file.
- Export writes to selected path.

### Suggested Commit

```text
feat: add audio player and file actions
```

---

## 10. Phase 8 — Setup Wizard ✅

### Goal

Convert backend/device/model preparation into a guided first-run experience.

### Tasks

1. Add `first_run_completed` setting. [x]
2. Add setup route/modal. [x]
3. Add directory picker for model/output directory. [x]
4. Run backend status check. [x]
5. Show logs path on failure. [x]
6. Bootstrap model download during setup. [x]

### Acceptance Criteria

- Fresh install opens setup wizard.
- Completed setup persists.
- Failed backend setup gives actionable error.
- User can reopen setup from Settings.

### Suggested Commit

```text
feat: add first-run setup wizard
```

---

## 11. Phase 9 — Settings and Error Polish 🔄

### Goal

Make the app usable and recoverable.

### Tasks

1. Build Settings UI. [x]
2. Implement error details disclosure. [x]
3. Add copy error button. [ ]
4. Add privacy-safe logging. [x]
5. Add app About panel. [ ]

### Acceptance Criteria

- Settings are persisted.
- Backend-impacting changes prompt restart.
- User can open logs folder.
- Errors show user message and technical details.
- Logs avoid full lyrics by default.

### Suggested Commit

```text
feat: add settings and recoverable error UI
```

---

## 12. Phase 10 — Packaging and Release Prep 🔄

### Goal

Prepare v0.1 Alpha for GitHub release.

### Tasks

1. Configure Tauri bundle for macOS Apple Silicon. [x]
2. Add icons. [x]
3. Add license files. [x]
4. Add README updates for installation/privacy. [x]
5. Add GitHub Actions CI. [x]
6. Final manual QA checklist. [ ]

### Acceptance Criteria

- `.dmg` builds locally.
- App launches from packaged build.
- README clearly marks Alpha status.
- Known limitations include Apple Silicon focus and local model requirements.
- CI passes.

### Suggested Commit

```text
chore: prepare alpha release packaging
```

---

## 13. Unified Error Model

Implement in Rust:

```rust
#[derive(Debug, serde::Serialize)]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
    pub recoverable: bool,
}
```

Recommended helper constructors:

```rust
impl AppError {
    pub fn backend_start_failed(details: impl Into<String>) -> Self;
    pub fn backend_health_timeout(details: impl Into<String>) -> Self;
    pub fn model_not_found(details: impl Into<String>) -> Self;
    pub fn task_submit_failed(details: impl Into<String>) -> Self;
    pub fn task_failed(details: impl Into<String>) -> Self;
    pub fn audio_download_failed(details: impl Into<String>) -> Self;
    pub fn output_write_failed(details: impl Into<String>) -> Self;
    pub fn db_write_failed(details: impl Into<String>) -> Self;
}
```

Frontend must display:

- `message` as primary text.
- `details` inside disclosure.
- `recoverable` controls whether retry button appears.

---

## 14. Generation Service Pseudocode

```rust
pub async fn generate_music(request: GenerationRequest) -> Result<GenerationRecord, AppError> {
    validate_generation_request(&request)?;

    backend_manager.ensure_healthy().await?;

    let task = ace_client.release_task(request.to_ace_payload()).await?;

    emit_event(GenerationEvent::Submitted { task_id: task.id });

    loop {
        let result = ace_client.query_result(vec![task.id.clone()]).await?;

        match result.status {
            TaskStatus::Running => {
                emit_event(GenerationEvent::Running);
                sleep(Duration::from_secs(2)).await;
            }
            TaskStatus::Succeeded(audio_ref) => {
                emit_event(GenerationEvent::Downloading);
                let bytes = ace_client.download_audio(audio_ref.file).await?;
                let output_path = file_store.write_audio(bytes, request.audio_format).await?;
                let record = db.insert_generation(request, output_path, result.metadata).await?;
                emit_event(GenerationEvent::Completed { generation_id: record.id });
                return Ok(record);
            }
            TaskStatus::Failed(error) => {
                let record = db.insert_failed_generation(request, error.clone()).await?;
                emit_event(GenerationEvent::Failed { error });
                return Err(error);
            }
        }
    }
}
```

---

## 15. Frontend Component Plan

### Components

```text
AppShell
  Sidebar
    HistorySearch
    HistoryList
    HistoryItem
  GenerationPanel
    PromptInput
    LyricsEditor
    DurationControl
    MusicParams
    SeedControl
    AdvancedParams
    GenerateButton
  PreviewPanel
    GenerationStatus
    AudioPlayer
    OutputActions
    ErrorDetails
  SettingsModal
  SetupWizard
```

### State

Use a lightweight store such as Zustand or React context.

```ts
type AppState = {
  backendStatus: BackendStatus;
  generationState: GenerationState;
  currentRequest: GenerationRequest;
  currentGeneration?: GenerationRecord;
  history: GenerationRecord[];
  settings: AppSettings;
};
```

---

## 16. Manual QA Checklist

Run before v0.1 Alpha release.

### Startup

- [ ] Fresh install opens setup wizard.
- [ ] Existing install opens main app.
- [ ] Unsupported architecture displays warning.
- [ ] Backend health check works.
- [ ] Backend start failure shows logs path.

### Generation

- [ ] Empty prompt and lyrics blocked.
- [ ] 10-second generation succeeds.
- [ ] 30-second generation succeeds on 16GB profile.
- [ ] Failed backend request shows error.
- [ ] Cancel stops frontend polling.
- [ ] Seed returned by backend is saved.

### Playback and Files

- [ ] Latest generation auto-loads in player.
- [ ] Play/pause works.
- [ ] Seek works.
- [ ] Reveal in Finder works.
- [ ] Missing file state works.
- [ ] Delete record works.
- [ ] Delete record + file works.

### Settings

- [ ] Output directory persists.
- [ ] Backend port persists.
- [ ] Restart backend works after changing port.
- [ ] Logs folder opens.
- [ ] Clear history requires confirmation.

### Privacy

- [ ] No telemetry requests.
- [ ] Logs do not contain full lyrics by default.
- [ ] Prompt/lyrics remain local.
- [ ] README states local-first privacy behavior and limitations.

---

## 17. Codex Task Prompts

Use these as sequential prompts in Codex.

### Prompt 1 — Bootstrap

```text
Initialize a Tauri v2 + React + TypeScript app for OpenLoop. Create a three-column shell UI matching docs/OpenLoop_PRD_Formal.md. Add strict TypeScript, cargo check compatibility, and README dev commands. Do not implement backend yet.
```

### Prompt 2 — Types and Validation

```text
Add the GenerationRequest, GenerationState, AppSettings, GenerationRecord, and AppError types. Implement validation for prompt/lyrics, duration, BPM, seed, and output format. Wire the generation form to these validators and show inline errors.
```

### Prompt 3 — SQLite

```text
Add SQLite persistence with migrations for settings, generations, and backend_events. Expose Tauri commands for reading/writing settings and listing/inserting/deleting generation records. Wire the history sidebar to real SQLite data.
```

### Prompt 4 — Device Detection

```text
Implement Rust-side device detection for macOS version, architecture, Apple Silicon status, and total memory. Return a recommended profile: unsupported, low-memory, standard, or quality. Show the result in setup/settings.
```

### Prompt 5 — Backend Manager

```text
Implement BackendManager in Rust to start, stop, restart, and health-check a local ACE-Step API server subprocess. Capture stdout/stderr into log files. Expose backend_status, start_backend, stop_backend, restart_backend commands. Use minimum Tauri shell/sidecar permissions.
```

### Prompt 6 — ACE Client

```text
Implement a local ACE-Step API client in Rust for /health, /v1/models, /release_task, /query_result, and /v1/audio. Parse the ACE-Step wrapper response and normalize status codes. Add unit tests with mocked responses.
```

### Prompt 7 — Generation Flow

```text
Connect the frontend Generate button to a Tauri generate_music command. The command should validate input, ensure backend health, submit /release_task, poll /query_result, download the audio, save it to the output directory, insert a generation record, and return it to the UI. Emit progress events.
```

### Prompt 8 — Player and File Actions

```text
Add an audio player for local generated files. Implement reveal_in_finder, file_exists, delete_generation_file, and export/copy actions. Add missing-file handling in the history panel.
```

### Prompt 9 — Setup Wizard

```text
Add a first-run setup wizard with device check, model/output directory selection, backend health check, and completion state. Persist first_run_completed. Allow reopening setup from Settings.
```

### Prompt 10 — Release Polish

```text
Polish settings, errors, logs, privacy-safe behavior, README, packaging config, and manual QA checklist. Prepare the app for a v0.1 Alpha GitHub release targeting Apple Silicon macOS.
```

---

## 18. v0.1 Alpha Exit Criteria

OpenLoop v0.1 Alpha is ready when:

- The app launches from a packaged `.dmg`.
- First-run setup completes on Apple Silicon.
- The backend can be started and health-checked.
- A 10-second text-to-music generation succeeds.
- The generated file plays inside the app.
- The generated file is saved to output directory.
- The generation is recorded in SQLite history.
- A history record can reload parameters.
- Errors are mapped through `AppError`.
- README documents installation, privacy, hardware requirements, and known limitations.
- Manual QA checklist is complete.
