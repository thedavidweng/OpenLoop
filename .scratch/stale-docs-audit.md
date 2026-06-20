# Stale Docs Audit

Repo: `/Users/david/Development/OpenLoop`
Generated: `2026-06-15T03:57:03Z`

## Section A — Issue tracker

Detected: GitHub remote.
Suggested tracker: GitHub Issues.
CLI: `gh` found.

### Git remotes

```
origin	git@github.com:thedavidweng/OpenLoop.git (fetch)
origin	git@github.com:thedavidweng/OpenLoop.git (push)
```

## Doc inventory

Doc files scanned: `44`

## Plan-era language

```
./docs/2026-06-10-issue-plans-and-evals.md:638:Produce `docs/adr/0005-platform-roadmap.md` classifying each target platform into a support tier, documenting every platform-specific code location, identifying external blockers, and defining a phased rollout plan.
```

## Forward-looking language

```
./docs/2026-06-10-issue-plans-and-evals.md:638:Produce `docs/adr/0005-platform-roadmap.md` classifying each target platform into a support tier, documenting every platform-specific code location, identifying external blockers, and defining a phased rollout plan.
./docs/2026-06-10-issue-plans-and-evals.md:646:**Files to Touch:** `docs/adr/0005-platform-roadmap.md` (new), `src-tauri/tests/platform_inventory.rs` (new), `src-tauri/tests/device_info_cross_platform.rs` (new), `src-tauri/tests/model_bootstrap_cross_platform.rs` (new), `src-tauri/tests/file_operations_cross_platform.rs` (new), `src-tauri/tests/model_descriptors_cross_platform.rs` (new), `src-tauri/src/services/device.rs`, `src-tauri/src/services/model_bootstrap.rs`, `src-tauri/src/commands/files.rs`, `src-tauri/src/commands/settings.rs`, `src-tauri/src/commands/support.rs`, `src-tauri/src/services/model_manager/mod.rs`, `src-tauri/src/platform/` (new module tree)
./docs/plans/2026-04-28-acestep-feature-benefits.md:5:The remaining ACE-Step feature backlog has been implemented in the app:
./docs/plans/2026-04-28-acestep-feature-benefits.md:14:Future work should be tracked in a new plan instead of reopening this completed backlog.
./docs/plans/2026-04-28-ui-review.md:5:The remaining UI review backlog has been implemented in the app:
./docs/plans/2026-04-28-ui-review.md:13:Future UI review findings should be tracked in a new plan instead of reopening this completed backlog.
./docs/plans/2026-05-14-v1-readiness-master-plan.md:189:- [x] 1.5.2 在 README 顶部加一行 `> **Status:** v0.1 Alpha — macOS Apple Silicon only. Windows / Linux on the roadmap.`——已通过 Status badge 实现（v0.2.1 Alpha）。
./docs/plans/2026-05-14-v1-readiness-master-plan.md:569:- [ ] 13.4 产出 `docs/adr/0005-platform-roadmap.md`。
./docs/plans/2026-05-14-v1-readiness-master-plan.md:571:**Phase 13 验收：** 产出 `docs/adr/0005-platform-roadmap.md`，包含各平台可行性结论与建议动作。
./docs/release.md:64:> Apple Developer ID signing and notarization will be added before a stable public release. Until then, Ad-hoc signing is the intentional distribution strategy for the open-source Alpha phase.
./docs/specs/event-schema.md:120:> **Note:** This envelope format is not yet emitted by any CLI command. Current completion events use bare JSON lines (see [Generation Task Events](#generation-task-events)). Wiring this envelope is a planned breaking shape change from the current bare payload: `output_path` becomes `path`, `duration` changes from float seconds to integer `duration_ms`, `format` is omitted, and `seed` is added.
./README.md:253:- No account system is planned.
./README.md:254:- No telemetry is planned.
./README.md:276:- Repaint is planned after the first Alpha.
./README.md:321:For the detailed development roadmap and planning documents, see:
```

## Agent instructions

```
./AGENTS.md:11:Five canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) mapped 1:1 to GitHub labels. See `docs/agents/triage-labels.md`.
./CHANGELOG.md:24:- Restore cursor:pointer on text links, remove dead .user-content class
./CONTEXT.md:46:- The CLI supports agent workflows: it can run headlessly, output machine-readable JSON, and auto-bootstrap the **Local Backend** and **Model Bootstrap** on first use.
./docs/2026-06-09-cli-clap-refactoring.md:96:`GenerationCommand` enum. Handles `list`, `cancel`, `resume`, `discard`.
./docs/2026-06-10-issue-plans-and-evals.md:532:#### Issue #60: First-run & Error UX: demo prompt path, Help section, What's new modal
./docs/2026-06-10-issue-plans-and-evals.md:544:**Files to Touch:** `src-tauri/src/models/settings.rs`, `src/app/lib/types.ts`, `src-tauri/src/commands/support.rs`, `src-tauri/src/commands/files.rs`, `src-tauri/tauri.conf.json`, `src-tauri/resources/demo/demo-prompt.wav` (new), `src/app/lib/whats-new.ts` (new), `src/app/components/bootstrap/WhatsNewModal.tsx` (new), `src/app/components/bootstrap/DemoBanner.tsx`, `src/app/components/settings/sections/HelpSection.tsx` (new), `src/app/components/settings/SettingsOverlay.tsx`, `src/app/lib/store/slices/ui.ts`, `src/locales/en.json`, `src/locales/zh-CN.json`
./docs/2026-06-10-issue-plans-and-evals.md:608:Phase 0: SHA256 hash acquisition. Phase 1: Multi-mirror settings model. Phase 2: Core download-with-mirrors logic. Phase 3: SHA256 mismatch triggers mirror fallback. Phase 4: Partial download resume across mirrors. Phase 5: CLI multi-mirror support. Phase 6: Frontend mirror list UI. Phase 7: Progress events include mirror info.
./docs/adr/0002-cli-gui-shared-service-layer.md:9:OpenLoop needs a CLI mode for agent integration in video production workflows. The current architecture couples the service layer (`AppState`, `BackendManager`, `Database`, `ModelManager`) to Tauri's `setup` closure in `lib.rs`. This makes it impossible to use the service layer without Tauri.
./docs/agents/triage-labels.md:9:| `ready-for-agent` | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
./docs/archive/plans/2026-04-24-openkara-shell-parity-design.md:52:- prompt and lyrics entry
./docs/archive/plans/2026-04-25-commercial-generation-workspace-design.md:43:- Negative prompt.
./docs/archive/plans/2026-04-25-commercial-generation-workspace-design.md:69:- Empty prompt/lyrics validation is visible but calm.
./docs/archive/plans/2026-04-25-commercial-generation-workspace-implementation.md:44:2. Make prompt the dominant horizontal textarea.
./docs/archive/plans/Development_Plan.md:197:  prompt TEXT,
./docs/archive/plans/Development_Plan.md:232:- History can be searched by prompt/lyrics.
./docs/archive/plans/Development_Plan.md:331:  "prompt": "<prompt>",
./docs/archive/plans/Development_Plan.md:486:- Backend-impacting changes prompt restart.
./docs/archive/plans/Development_Plan.md:666:- [ ] Empty prompt and lyrics blocked.
./docs/archive/plans/Development_Plan.md:713:Add the GenerationRequest, GenerationState, AppSettings, GenerationRecord, and AppError types. Implement validation for prompt/lyrics, duration, BPM, seed, and output format. Wire the generation form to these validators and show inline errors.
./docs/archive/plans/Development_Plan.md:780:- NDJSON streaming for agent workflows.
./docs/cli.md:9:Generate music from a prompt.
./docs/cli.md:35:Enhance a prompt via the ACE-Step format_input API. Returns the enhanced caption together with extracted BPM, key, time signature, duration, language, and lyrics.
./docs/cli.md:155:Manage the generation lifecycle — list, cancel, resume, or discard active tasks.
./docs/cli.md:163:openloop generation resume abc12345      # resume an active generation task
./docs/cli.md:227:`openloop` is designed for AI coding agents to compose with. Paired with **[Remotion](https://github.com/remotion-dev/remotion)** (programmatic React video rendering) or **[HyperFrames](https://github.com/heygen-com/hyperframes)** (HTML-to-video for agents), an agent can build fully automated video workflows.
./docs/cli.md:229:An agent would typically:
./docs/implementation-status.md:20:- Active task recovery: resume or discard pending generation tasks.
./docs/implementation-status.md:22:- Random prompt inspiration (dice button).
./docs/implementation-status.md:28:- NDJSON streaming for agent pipeline integration.
./docs/OpenLoop_PRD.md:67:| 注重隐私的用户       | 避免上传歌词、prompt、音频素材 | 默认本地推理、本地历史、本地文件 |
./docs/OpenLoop_PRD.md:171:| 风格描述     | `prompt`          |      string | empty              | 建议必填，但允许歌词驱动                 |
./docs/OpenLoop_PRD.md:311:用户输入 prompt/lyrics/duration 等参数后生成音频文件。
./docs/OpenLoop_PRD.md:349:- 历史记录保存 prompt、lyrics、duration、seed、model、output_path。
./docs/OpenLoop_PRD.md:356:| prompt + lyrics | 两者至少一个非空        |
./docs/OpenLoop_PRD.md:426:- 文件名不得直接包含完整 prompt，避免隐私泄露和非法字符问题。
./docs/OpenLoop_PRD.md:450:  prompt TEXT,
./docs/OpenLoop_PRD.md:475:- 支持搜索 prompt/lyrics。
./docs/OpenLoop_PRD.md:570:- 不上传 prompt、lyrics、生成音频。
./docs/OpenLoop_PRD.md:622:- 时间、时长、简短 prompt。
./docs/plans/2026-04-28-acestep-feature-benefits.md:7:- AI prompt enhancement calls the local ACE-Step `/format_input` endpoint through Tauri IPC.
./docs/plans/2026-04-28-acestep-feature-benefits.md:9:- Prompt inspiration uses a local JSON example library instead of a hardcoded prompt.
./docs/plans/2026-04-28-ui-review.md:10:- ToastProvider is mounted and app actions publish transient localized toasts for settings, prompt enhancement, export/copy, delete, and generation outcomes.
./docs/plans/2026-05-13-cli-backend-vnext.md:221:| `enhance_prompt`                 | `openloop enhance "<prompt>"` 或 `openloop generation enhance`（与 IPC `enhance_prompt` 命名对齐；不使用 `format` 避免与 `--format` 音频标志混淆） |
./docs/plans/2026-05-13-cli-backend-vnext.md:223:| `resume_generation_task`         | `openloop generation resume <id>`                                                                                                                  |
./docs/plans/2026-05-14-v1-readiness-master-plan.md:37:| **P14a** Project 概念（核心） | Project 数据模型、侧栏分组                                           | 摆脱「单 prompt 单 clip」工具感    |
./docs/plans/2026-05-14-v1-readiness-master-plan.md:249:│   │   └── tasks.ts        ← activeTasks、resume、discard ← 仍内嵌在 generation.ts，未独立 slice
./docs/plans/2026-05-14-v1-readiness-master-plan.md:337:- [x] 4.3.2 提交成功时 push；UI 在 prompt 输入框上方加一行 chip 列表（最近 6 条），可点击填入。——已实现于 `Header.tsx:39-52`
./docs/plans/2026-05-14-v1-readiness-master-plan.md:338:- [x] 4.3.3 Dice 按钮旁加 ⭐ 图标，把当前 prompt 加到 `favoritePrompts`，独立列表（上限 50）。——已实现于 `Header.tsx:40-41`
./docs/plans/2026-05-14-v1-readiness-master-plan.md:345:- [ ] 4.4.3 i18n 中文版同步翻译每个示例的中文描述（不替换 prompt 本身，只翻译类目）。
./docs/plans/2026-05-14-v1-readiness-master-plan.md:412:  - Copy as data URL（agent 友好）
./docs/plans/2026-05-14-v1-readiness-master-plan.md:438:- [x] 8.3 加 "Skip and try a demo prompt" 路径：跳过模型下载，进入"演示模式"——当前无 bundled 音频，先进入可关闭的 Demo mode banner。
./docs/plans/2026-05-14-v1-readiness-master-plan.md:441:**Phase 8 验收：** 首次启动流程可完整走通且显示 ETA；"Skip and try a demo prompt" 路径跳过下载后能播放 bundled 示例音频。
./docs/plans/2026-05-14-v1-readiness-master-plan.md:454:  - **不包含** prompt、lyrics、文件路径以外的内容（与 README 隐私段一致）
./docs/plans/2026-05-14-v1-readiness-master-plan.md:470:**Phase 9 验收：** "Copy diagnostics" 按钮输出 JSON 不包含 prompt/lyrics；GitHub issue 链接可打开且预填 diagnostics；错误 banner 可展开详情且 Retry 按钮可用。
./docs/plans/2026-05-14-v1-readiness-master-plan.md:536:  2. 已设置 → 写 prompt → 提交 → 看见结果（mock backend）
./docs/plans/2026-05-14-v1-readiness-master-plan.md:541:- [ ] 12.2.1 `scripts/bench.mjs`：固定 5 条 prompt × 3 次生成，记录耗时 / 内存峰值。
./docs/plans/2026-05-14-v1-readiness-master-plan.md:598:- [ ] 14b.1.3 文档化"原音频 + 区间 + 新 prompt → 局部替换"工作流。
./docs/plans/2026-05-14-v1-readiness-master-plan.md:713:本文件可作为后续所有 GSD phase plan 的源 prompt；建议每两周 review 一次并把已完成项标注 `~~strike~~` 或迁移到 `archive/`。
./docs/plans/2026-05-17-complexity-hotspots-optimization.md:58:  - prompt match
./docs/plans/2026-05-17-complexity-hotspots-optimization.md:150:- Manual check: search still finds prompt and lyrics matches.
./docs/plans/2026-05-17-complexity-hotspots-optimization.md:234:- FTS5 search migration for prompt/lyrics.
./docs/plans/2026-05-17-complexity-hotspots-optimization.md:258:- Confirm history search returns expected prompt/lyrics matches.
./docs/plans/2026-05-30-cli-ux-fixes.md:72:**Problem:** After `openloop enhance` prints the enhanced prompt, the backend detach happens silently. No "Backend detached" or similar message. Users may not know the backend is still running.
./docs/plans/2026-05-30-cli-ux-fixes.md:83:2. P1: Duplicate completed event (quick fix, high agent impact)
./docs/release-notes/v0.1.0.md:7:OpenLoop ships with a full-featured CLI built into the same binary. Every GUI operation has a CLI equivalent — designed for scripting, automation, and agent-driven workflows.
./docs/release-notes/v0.1.0.md:10:# Generate music from a text prompt
./docs/release-notes/v0.1.0.md:22:# Stream progress as NDJSON (ideal for agent pipelines)
./docs/release-notes/v0.1.0.md:28:OpenLoop was designed to be **agent-friendly**. Combined with tools like [Remotion](https://github.com/remotion-dev/remotion) (programmatic React video rendering) and [HyperFrames](https://github.com/heygen-com/hyperframes) (HTML-to-video for agents), you can build fully automated AI video pipelines:
./docs/release-notes/v0.1.0.md:34:An AI agent can orchestrate the entire video production chain: generate background music via `openloop run`, render visuals via Remotion, add voiceover — all without touching a GUI.
./docs/release-notes/v0.1.0.md:59:- **NDJSON streaming** — Machine-readable progress output for agent pipelines
./docs/specs/2026-05-04-openloop-cli-design.md:7:Primary use case: agent integration in video production workflows (Remotion/Hyperframes). The agent calls `openloop run "prompt"`, gets back a file path, uses it in the video pipeline.
./docs/specs/2026-05-04-openloop-cli-design.md:143:Generate music. The primary command for agent workflows.
./docs/specs/2026-05-04-openloop-cli-design.md:148:openloop run [FLAGS] <prompt>
./docs/specs/2026-05-04-openloop-cli-design.md:153:- `prompt` — text description of the music to generate
./docs/specs/2026-05-04-openloop-cli-design.md:252:# JSON mode for agent parsing
./docs/specs/2026-05-04-openloop-cli-design.md:293:  Enable reasoning for better prompt understanding.
./docs/specs/2026-05-04-openloop-cli-design.md:416:    "prompt": "epic cinematic track",
./docs/specs/2026-05-04-openloop-cli-design.md:559:      "prompt": "epic cinematic",
./docs/specs/2026-05-04-openloop-cli-design.md:632:2. In human mode (no `--json`): if `--yes` not set, prompt: "Delete 15 records and their output files? [y/N]"
./docs/specs/2026-05-04-openloop-cli-design.md:633:3. In JSON mode: auto-confirm (no interactive prompt).
```

## Owner/status sections

```
./docs/cli.md:170:Show unified system status: backend health, model info, active tasks, and device info.
./docs/plans/2026-05-17-complexity-hotspots-optimization.md:6:**Patch status:** Plan only. No code changes in this document.
./docs/plans/2026-05-30-cli-ux-fixes.md:17:**Problem:** A new `AppState` always initializes `BackendManager` with `status: Stopped`. The `status()` method only probes the health endpoint if the current status is already `Healthy`. So `openloop backend status` always reports "stopped" for backends started by a previous CLI invocation or the GUI — even when the backend is actually healthy on the port.
```

## History in references

```
./CHANGELOG.md:16:- Virtualize history sidebar list with @tanstack/react-virtual
./CHANGELOG.md:121:- **history**: A/B compare, multi-select cap at 2, batch export, drag-out support
./CHANGELOG.md:137:- Mark completed P5.3 P6.4 P7 P8 P9 and P10 items
./CONTEXT.md:3:OpenLoop is a local-first music generation tool for Apple Silicon, powered by a local ACE-Step backend. It has two interfaces — a desktop GUI and a command-line CLI — that share all state: settings, history, models, and the backend process.
./CONTEXT.md:8:The lifecycle for one user generation request from validation through backend execution, recovery, cancellation, and completion.
./CONTEXT.md:11:The persisted result of a completed Generation Task.
./CONTEXT.md:15:The local audio file associated with a completed Generation Record.
./CONTEXT.md:16:_Avoid_: Generation Record, history file
./CONTEXT.md:56:- **History** cleanup is a normal user-facing action, similar to clearing search history.
./CONTEXT.md:61:- **Backend Logs** are diagnostic artifacts with automatic retention, not user-managed history.
./CONTEXT.md:71:- **History** UI should read as generated music history, not as a technical run log.
./CONTEXT.md:81:> **Domain expert:** "No. Users need single-output deletion and clear-all history cleanup."
./CONTEXT.md:88:- "History" was previously used to mean both generated outputs and failed attempts; resolved: **History** is generated music outputs only.
./CONTEXT.md:89:- "Cancelled" was previously treated like a **Generation Record** status; resolved: user cancellation is not part of **History**.
./CONTEXT.md:90:- "Failed" was previously treated like a **Generation Record** status; resolved: backend failure is a run outcome, not a **History** item.
./docs/2026-06-09-cli-clap-refactoring.md:160:6. `openloop completions zsh` produces valid completion script
./docs/2026-06-10-issue-plans-and-evals.md:29:| P1 | #52 | Security | S | None | 5 of 8 items done; remaining URL centralization + network log are trust-boundary work |
./docs/2026-06-10-issue-plans-and-evals.md:34:| P2 | #54 | UX | M | #53 (Phase 4) | Sticky footer is CSS-only; CLI --from-history needs #58 landed first |
./docs/2026-06-10-issue-plans-and-evals.md:69:**Exit criteria:** CLI refactoring committed, all CI green, license badge corrected, history queries use indexes.
./docs/2026-06-10-issue-plans-and-evals.md:191:| `src/app/components/history/HistorySidebar.tsx` | #53, #55, #59, #65 |
./docs/2026-06-10-issue-plans-and-evals.md:209:Close task 1.1.5 in the v1 readiness master plan by ensuring every release note file that references a DMG download includes a consistent, complete Gatekeeper bypass section, and by marking the task as done. The README and release.md already have the content; the gap is that `v0.2.0.md` and `v0.2.1.md` lack Gatekeeper guidance despite shipping DMGs, and there is no shared template or CI check to prevent future release notes from omitting it.
./docs/2026-06-10-issue-plans-and-evals.md:309:4. JSON mode emits exactly one completed event per variation
./docs/2026-06-10-issue-plans-and-evals.md:317:Phase 1: Backend detach (1 test, 1 line). Phase 2: Backend status discovery (2 tests, ~15 lines). Phase 3: Duplicate completed event suppression (1 test, ~5 lines). Phase 4: Non-TTY progress output (2 tests, ~10 lines). Phase 5: HTTP client timeout audit (1 test, constant changes). Phase 6: Models list manifest sync (1 test, ~20 lines). Phase 7: Enhance detach message (1 test, 2 lines).
./docs/2026-06-10-issue-plans-and-evals.md:321:**Effort:** S (1-2 days). All 7 items are already implemented in the working tree. Work remaining is writing 7-8 missing integration tests.
./docs/2026-06-10-issue-plans-and-evals.md:460:#### Issue #54: Main Form UX: sticky footer, CLI --from-history, dice categories
./docs/2026-06-10-issue-plans-and-evals.md:464:Sticky footer with gradient fade, CLI `--from-history <id>` for replaying generations, dice button long-press for category menu.
./docs/2026-06-10-issue-plans-and-evals.md:470:Phase 1: Sticky Footer + Gradient (CSS-only). Phase 2: CLI `--from-history` (Rust backend). Phase 3: Dice Long-Press (frontend).
./docs/2026-06-10-issue-plans-and-evals.md:490:**Files to Touch:** `src/app/components/player/ComparePlayer.tsx` (new), `src/app/components/player/PlaybackBar.tsx`, `src/app/components/history/HistorySidebar.tsx`, `src/app/lib/store/slices/history.ts`, `src/app/lib/app-shortcuts.ts`, `src/locales/en.json`, `src/locales/zh-CN.json`, `tests/unit/compare-player.test.tsx` (new)
./docs/2026-06-10-issue-plans-and-evals.md:514:#### Issue #59: Performance optimization: history DB queries, backend-driven search
./docs/2026-06-10-issue-plans-and-evals.md:524:Phase 0: Baseline tests. Phase 1: Indexed and bounded history queries. Phase 2: History row membership sets. Phase 3: CLI prefix lookup without full history load. Phase 4: Backend-driven history search. Phase 5: CLI list command uses database limit.
./docs/2026-06-10-issue-plans-and-evals.md:526:**Files to Touch:** `src-tauri/migrations/005_history_indexes.sql` (new), `src-tauri/src/services/db.rs`, `src-tauri/src/services/history.rs`, `src-tauri/src/commands/history.rs`, `src-tauri/src/cli/list.rs`, `src-tauri/src/cli/delete.rs`, `src-tauri/src/cli/files.rs`, `src/app/lib/api.ts`, `src/app/lib/store/slices/history.ts`, `src/app/components/history/SearchBox.tsx`, `src/app/components/history/HistorySidebar.tsx`
./docs/2026-06-10-issue-plans-and-evals.md:602:Users configure an ordered list of mirror URLs. Downloads fail over automatically. SHA256 verification runs after every completed file.
./docs/2026-06-10-issue-plans-and-evals.md:670:**Files to Touch:** `src-tauri/migrations/005_add_projects.sql` (new), `src-tauri/src/models/project.rs` (new), `src-tauri/src/models/generation.rs`, `src-tauri/src/services/db.rs`, `src-tauri/src/commands/project.rs` (new), `src-tauri/src/commands/history.rs`, `src-tauri/src/cli/cli.rs`, `src-tauri/src/cli/run.rs`, `src-tauri/src/cli/list.rs`, `src/app/lib/types.ts`, `src/app/lib/api.ts`, `src/app/lib/store/types.ts`, `src/app/lib/store/slices/projects.ts` (new), `src/app/components/history/HistorySidebar.tsx`, `CONTEXT.md`
./docs/2026-06-10-issue-plans-and-evals.md:758:Phase 1: Data model and backend persistence. Phase 2: Apply profile and rename. Phase 3: Migration from v0.1 settings. Phase 4: CLI subcommand group. Phase 5: Tauri IPC commands. Phase 6: Frontend types, API layer, and store slice. Phase 7: Frontend UI -- Profile management section. Phase 8: Generation history records profile name.
./docs/adr/0001-history-represents-generated-outputs.md:3:OpenLoop history represents generated music outputs, not every generation attempt. Completed tasks create history entries tied to local output files; failed and cancelled tasks remain current-run outcomes so users can adjust settings and retry without mixing playable outputs with non-file attempts. This keeps the beginner-facing history model simple: deleting history deletes generated outputs, with explicit confirmation and affected counts.
./docs/adr/0002-cli-gui-shared-service-layer.md:15:CLI and GUI share all state: the same SQLite database, the same ACE-Step backend process (via health check on the configured port), the same settings, and the same generation history.
./docs/adr/0002-cli-gui-shared-service-layer.md:19:- **Positive**: Single binary, single source of truth. CLI tasks appear in GUI history. Settings changed via CLI affect GUI. No synchronization needed — they share the same SQLite file.
./docs/agents/domain.md:21:│   ├── 0001-history-represents-generated-outputs.md
./docs/archive/plans/2026-04-24-openkara-shell-parity-design.md:42:- generation history
./docs/archive/plans/2026-04-24-openkara-shell-parity-design.md:44:- quick batch or utility actions relevant to generation history
./docs/archive/plans/2026-04-24-openkara-shell-parity-implementation.md:23:2. Preserve any OpenLoop-only utility classes still needed by generation/preview/history content.
./docs/archive/plans/2026-04-24-openkara-shell-parity-implementation.md:68:2. Mount OpenLoop history in the sidebar rail.
./docs/archive/plans/2026-04-24-openkara-shell-parity-implementation.md:83:- Modify: `src/app/components/history/HistorySidebar.tsx`
./docs/archive/plans/2026-04-24-openkara-shell-parity-implementation.md:89:2. Reframe history, generation, and preview to fit the OpenKara shell roles.
./docs/archive/plans/2026-04-24-openkara-shell-parity-implementation.md:129:2. Replace library steps with OpenLoop-specific introduction, device check, backend/model prep, path configuration, and completion.
./docs/archive/plans/2026-04-25-commercial-generation-workspace-design.md:11:The current right-side generation drawer is removed. It competes with the history sidebar and compresses the main stage. The new layout uses one left history rail and one central workspace.
./docs/archive/plans/Development_Plan.md:47:        history/
./docs/archive/plans/Development_Plan.md:69:        history.rs
./docs/archive/plans/Development_Plan.md:110:   - Left history column.
./docs/archive/plans/Development_Plan.md:160:- State machine can handle `idle → validating → running → completed/failed`.
./docs/archive/plans/Development_Plan.md:175:Add local persistence for settings, generation history, and backend events.
./docs/archive/plans/Development_Plan.md:182:4. Implement Tauri commands for settings and history. [x]
./docs/archive/plans/Development_Plan.md:183:5. Implement frontend history panel. [x]
./docs/archive/plans/Development_Plan.md:231:- Mock generation records appear in history.
./docs/archive/plans/Development_Plan.md:239:feat: add sqlite settings and generation history
./docs/archive/plans/Development_Plan.md:377:5. Handle history creation and output directory saving. [x]
./docs/archive/plans/Development_Plan.md:390:  | { type: "completed"; generationId: string; outputPath: string }
./docs/archive/plans/Development_Plan.md:645:  history: GenerationRecord[];
./docs/archive/plans/Development_Plan.md:689:- [ ] Clear history requires confirmation.
./docs/archive/plans/Development_Plan.md:719:Add SQLite persistence with migrations for settings, generations, and backend_events. Expose Tauri commands for reading/writing settings and listing/inserting/deleting generation records. Wire the history sidebar to real SQLite data.
./docs/archive/plans/Development_Plan.md:749:Add an audio player for local generated files. Implement reveal_in_finder, file_exists, delete_generation_file, and export/copy actions. Add missing-file handling in the history panel.
./docs/archive/plans/Development_Plan.md:755:Add a first-run setup wizard with device check, model/output directory selection, backend health check, and completion state. Persist first_run_completed. Allow reopening setup from Settings.
./docs/archive/plans/Development_Plan.md:768:OpenLoop v0.1.0 Alpha shipped with:
./docs/archive/plans/Development_Plan.md:775:- Generation history persists in SQLite with search, load, and delete.
./docs/cli.md:64:Show generation history.
./docs/cli.md:118:Delete all generation history and output files.
./docs/cli.md:232:2. Take the `output_path` from the completed event
./docs/cli.md:246:{"event":"completed","output_path":"/abs/path/track.wav","duration":30.0,"format":"wav"}
./docs/implementation-status.md:12:- SQLite persistence for settings, generation history, and backend events.
./docs/implementation-status.md:18:- Generation history sidebar with search, click-to-load, and delete options.
./docs/OpenLoop_PRD.md:324:| `completed`        | 生成成功     |
./docs/OpenLoop_PRD.md:339:  → insert history row
./docs/OpenLoop_PRD.md:817:- Write history.
./docs/OpenLoop_PRD.md:818:- Load history into form.
./docs/plans/2026-04-28-acestep-feature-benefits.md:5:The remaining ACE-Step feature backlog has been implemented in the app:
./docs/plans/2026-04-28-acestep-feature-benefits.md:14:Future work should be tracked in a new plan instead of reopening this completed backlog.
./docs/plans/2026-04-28-ui-review.md:5:The remaining UI review backlog has been implemented in the app:
./docs/plans/2026-04-28-ui-review.md:7:- Generation progress now carries structured phases for validation, backend startup, submission, queueing, running, downloading, completion, failure, cancellation, and recovery.
./docs/plans/2026-04-28-ui-review.md:13:Future UI review findings should be tracked in a new plan instead of reopening this completed backlog.
./docs/plans/2026-05-13-cli-backend-vnext.md:205:### 6.6 历史 `commands::history`
```

## Archive-folder smells

```
./docs/archive
```

## Contract files containing journey language

```
./CHANGELOG.md:140:- Update README status to v0.2.0
./CONTEXT.md:89:- "Cancelled" was previously treated like a **Generation Record** status; resolved: user cancellation is not part of **History**.
./CONTEXT.md:90:- "Failed" was previously treated like a **Generation Record** status; resolved: backend failure is a run outcome, not a **History** item.
./docs/2026-06-09-cli-clap-refactoring.md:102:Migrate all remaining: `list`, `delete`, `clear`, `ps`, `stop`, `pull`, `status`, `doctor`, `files`, `setup`. (Note: `setup` is large and contains interactive wizard logic that needs careful handling with clap).
./docs/2026-06-09-cli-clap-refactoring.md:135:| **Rewrite** | `cli/run.rs`, `cli/enhance.rs`, `cli/backend.rs`, `cli/models.rs`, `cli/settings.rs`, `cli/generation.rs`, `cli/files.rs`, `cli/list.rs`, `cli/delete.rs`, `cli/clear.rs`, `cli/ps.rs`, `cli/stop.rs`, `cli/pull.rs`, `cli/status.rs`, `cli/doctor.rs`, `cli/setup.rs` |
./docs/2026-06-10-issue-plans-and-evals.md:166:| CLI refactoring (#58) breaks existing commands | High | Phase 0 commits current state first; each phase compiles independently | #58 |
./docs/2026-06-10-issue-plans-and-evals.md:236:#### Issue #69: README status badge, README_CN sync, CSP ADR finalization
./docs/2026-06-10-issue-plans-and-evals.md:240:All three project READMEs/ADRs are internally consistent: the CSP ADR references current Tauri 2 documentation, both READMEs display an Apache-2.0 license badge, both show the v0.1 Alpha status line, README_CN.md includes the missing Release badge, and the v1 readiness master plan has tasks 1.2.4, 1.5.2, and 1.5.3 checked off.
./docs/2026-06-10-issue-plans-and-evals.md:246:3. README.md contains status line with v0.1 Alpha
./docs/2026-06-10-issue-plans-and-evals.md:247:4. README_CN.md contains status line with v0.1 Alpha (Chinese)
./docs/2026-06-10-issue-plans-and-evals.md:302:Eliminate seven CLI UX defects: backend dying on CLI exit, status unable to find running backends, duplicate JSON events, messy progress on non-TTYs, premature HTTP timeouts, stale model metadata, and silent backend detach in `enhance`.
./docs/2026-06-10-issue-plans-and-evals.md:307:2. backend status discovers externally-running backends
./docs/2026-06-10-issue-plans-and-evals.md:308:3. backend status reports stopped when no backend answers
./docs/2026-06-10-issue-plans-and-evals.md:317:Phase 1: Backend detach (1 test, 1 line). Phase 2: Backend status discovery (2 tests, ~15 lines). Phase 3: Duplicate completed event suppression (1 test, ~5 lines). Phase 4: Non-TTY progress output (2 tests, ~10 lines). Phase 5: HTTP client timeout audit (1 test, constant changes). Phase 6: Models list manifest sync (1 test, ~20 lines). Phase 7: Enhance detach message (1 test, 2 lines).
./docs/2026-06-10-issue-plans-and-evals.md:638:Produce `docs/adr/0005-platform-roadmap.md` classifying each target platform into a support tier, documenting every platform-specific code location, identifying external blockers, and defining a phased rollout plan.
./docs/2026-06-10-issue-plans-and-evals.md:646:**Files to Touch:** `docs/adr/0005-platform-roadmap.md` (new), `src-tauri/tests/platform_inventory.rs` (new), `src-tauri/tests/device_info_cross_platform.rs` (new), `src-tauri/tests/model_bootstrap_cross_platform.rs` (new), `src-tauri/tests/file_operations_cross_platform.rs` (new), `src-tauri/tests/model_descriptors_cross_platform.rs` (new), `src-tauri/src/services/device.rs`, `src-tauri/src/services/model_bootstrap.rs`, `src-tauri/src/commands/files.rs`, `src-tauri/src/commands/settings.rs`, `src-tauri/src/commands/support.rs`, `src-tauri/src/services/model_manager/mod.rs`, `src-tauri/src/platform/` (new module tree)
./docs/adr/0004-network-trust-boundary.md:97:3. **No documented boundary (status quo):** Rejected — risks erosion of
./docs/archive/plans/2026-04-24-openkara-shell-parity-design.md:5:Make OpenLoop feel like a direct sibling product of OpenKara by reusing the same product shell, visual tokens, settings surface, onboarding rhythm, bootstrap status expression, and native menu structure while keeping OpenLoop-specific generation workflows in the main content area.
./docs/archive/plans/2026-04-24-openkara-shell-parity-design.md:90:OpenLoop should use the same top-of-main-content status treatment as OpenKara's `ModelBootstrapBanner`.
./docs/archive/plans/2026-04-25-commercial-generation-workspace-design.md:21:│               │ Current task / result / status / errors     │
./docs/archive/plans/2026-04-25-commercial-generation-workspace-design.md:72:- Local-first behavior remains visible through copy and status.
./docs/archive/plans/2026-04-25-commercial-generation-workspace-implementation.md:24:2. Render status/result content in the main stage.
./docs/archive/plans/Development_Plan.md:213:  status TEXT NOT NULL,
./docs/archive/plans/Development_Plan.md:234:- File deletion can be deferred to later phase.
./docs/archive/plans/Development_Plan.md:282:3. Implement start/stop/status/logs commands. [x]
./docs/archive/plans/Development_Plan.md:452:4. Run backend status check. [x]
./docs/archive/plans/Development_Plan.md:519:- README clearly marks Alpha status.
./docs/archive/plans/Development_Plan.md:583:        match result.status {
./docs/archive/plans/Development_Plan.md:725:Implement Rust-side device detection for macOS version, architecture, Apple Silicon status, and total memory. Return a recommended profile: unsupported, low-memory, standard, or quality. Show the result in setup/settings.
./docs/archive/plans/Development_Plan.md:737:Implement a local ACE-Step API client in Rust for /health, /v1/models, /release_task, /query_result, and /v1/audio. Parse the ACE-Step wrapper response and normalize status codes. Add unit tests with mocked responses.
./docs/cli.md:101:Show backend process status and active generation tasks.
./docs/cli.md:140:openloop backend status          # show backend health and port
./docs/cli.md:168:### `openloop status`
./docs/cli.md:170:Show unified system status: backend health, model info, active tasks, and device info.
./docs/cli.md:173:openloop status
./docs/cli.md:174:openloop status --json
./docs/implementation-status.md:3:> **Last updated:** 2026-06-03 · This file mirrors the implementation status section from the main README and is updated alongside releases.
./docs/implementation-status.md:23:- Model bootstrap system with download progress, ready/failed states, and persistent status banner.
./docs/implementation-status.md:27:- CLI mode with 16 subcommands (run, setup, list, pull, models, ps, delete, clear, stop, enhance, backend, generation, settings, status, doctor, files).
./docs/implementation-status.md:31:- Backend management CLI: `backend provision`, `backend update`, `backend status` subcommands.
./docs/OpenLoop_PRD.md:336:  → when status=1, parse result JSON string
./docs/OpenLoop_PRD.md:466:  status TEXT NOT NULL,
./docs/plans/2026-05-13-cli-backend-vnext.md:38:| **M3** | [x] 统一遥测输出（人类 / JSON / NDJSON）与 `doctor`/`status` | M0、部分 M1          |
./docs/plans/2026-05-13-cli-backend-vnext.md:105:- `phase`: `backend_check` | `backend_start` | `backend_owned` | `backend_attached` | `backend_ready` | `backend_stop` | `model_check` | `model_download` | `task_submit` | `task_poll` | …
./docs/plans/2026-05-13-cli-backend-vnext.md:124:| `openloop ps` / `openloop status` | 与 `backend_status` 一致的结构化字段 + 活跃任务列表与任务来源（若可区分）     |
./docs/plans/2026-05-13-cli-backend-vnext.md:159:| `backend_status`        | `openloop backend status`（或并入 `openloop status`）         |
./docs/plans/2026-05-13-cli-backend-vnext.md:198:| `get_model_status`        | `openloop models status [variant]`                                         |
./docs/plans/2026-05-13-cli-backend-vnext.md:222:| `list_active_generation_tasks`   | 并入 `openloop status` / `openloop ps`                                                                                                             |
./docs/plans/2026-05-13-cli-backend-vnext.md:242:- **契约测试（M0 完成后开始）：** 扩展 `src-tauri/tests/cli_contract.rs`：解析 NDJSON `v:1` 最小集合，验证 `kind` / `ts` / `phase` 字段存在；`backend status --json` 做 schema snapshot。
./docs/plans/2026-05-13-cli-backend-vnext.md:269:1. **Week 1：** M0 契约 + `backend` 子命令壳 + `status`/`doctor` 骨架
./docs/plans/2026-05-14-v1-readiness-master-plan.md:16:> 每个 Phase 末尾都有「**P 优先级 / 依赖**」表。可作为后续 `/gsd-plan-phase` 的直接输入。
./docs/plans/2026-05-14-v1-readiness-master-plan.md:189:- [x] 1.5.2 在 README 顶部加一行 `> **Status:** v0.1 Alpha — macOS Apple Silicon only. Windows / Linux on the roadmap.`——已通过 Status badge 实现（v0.2.1 Alpha）。
./docs/plans/2026-05-14-v1-readiness-master-plan.md:569:- [ ] 13.4 产出 `docs/adr/0005-platform-roadmap.md`。
./docs/plans/2026-05-14-v1-readiness-master-plan.md:571:**Phase 13 验收：** 产出 `docs/adr/0005-platform-roadmap.md`，包含各平台可行性结论与建议动作。
./docs/plans/2026-05-14-v1-readiness-master-plan.md:698:- 推荐用 `/gsd-plan-phase P<n>` 把本文件第 N 章扔给 GSD planner 自动生成 `PLAN.md`。
./docs/plans/2026-05-14-v1-readiness-master-plan.md:705:- **`docs/plans/2026-05-13-cli-backend-vnext.md`**：~~其 M0–M5 的事件契约 / 后端归属 / 跨进程取消~~。**已实施完毕：** `cli::events` v1 schema、`BackendManager::ownership()`（Owned/Attached/Stopped）、`cancel_requested_at` DB 标志位、`BackendManager::detach()` CLI 用射声明、`exit_code()` 分流、全套 CLI 子命令树（backend/models/generation/files/settings/doctor/status/ps）。P11 只需在其之上扩展 GUI 侧结构化日志与 in-app 查看器。
./docs/plans/2026-05-14-v1-readiness-master-plan.md:713:本文件可作为后续所有 GSD phase plan 的源 prompt；建议每两周 review 一次并把已完成项标注 `~~strike~~` 或迁移到 `archive/`。
./docs/plans/2026-05-17-complexity-hotspots-optimization.md:5:**Scope:** Reduce real data-size-sensitive complexity in history, search, CLI prefix lookup, and model status aggregation.  
./docs/plans/2026-05-17-complexity-hotspots-optimization.md:6:**Patch status:** Plan only. No code changes in this document.
./docs/plans/2026-05-17-complexity-hotspots-optimization.md:44:| Model pack status aggregation | `src/app/lib/model-packs.ts`, settings/setup UI             | Re-filter statuses per pack/variant                                       | Small `O(pack_count * statuses)`        | P2       |
./docs/plans/2026-05-17-complexity-hotspots-optimization.md:87:  - index completed generated outputs by `status`, output presence, `is_favorite`, and `created_at`
./docs/plans/2026-05-17-complexity-hotspots-optimization.md:88:  - keep the index aligned with the current `WHERE status = 'completed' AND COALESCE(output_path, '') <> '' ORDER BY is_favorite DESC, created_at DESC`
./docs/plans/2026-05-17-complexity-hotspots-optimization.md:245:Run narrow checks after each phase, then broader checks before merge:
./docs/plans/2026-05-30-cli-ux-fixes.md:15:## P0 — `backend status` can't discover externally-running backends
./docs/plans/2026-05-30-cli-ux-fixes.md:17:**Problem:** A new `AppState` always initializes `BackendManager` with `status: Stopped`. The `status()` method only probes the health endpoint if the current status is already `Healthy`. So `openloop backend status` always reports "stopped" for backends started by a previous CLI invocation or the GUI — even when the backend is actually healthy on the port.
./docs/plans/2026-05-30-cli-ux-fixes.md:19:**Fix:** In `BackendManager::status()`, when `self.child` is `None` and `self.status` is `Stopped`, probe the configured port's health endpoint. If healthy, transition to `Healthy { port }` (attached ownership). This requires the port to be available — either pass it into `status()` or store it on `BackendManager`.
./docs/plans/2026-05-30-cli-ux-fixes.md:64:**Fix:** On `doctor` and `models list`, cross-check the manifest against the DB setting. If the manifest has entries that the DB doesn't, offer to sync (or auto-sync silently). Alternatively, always read from the manifest as the source of truth for download status.
./docs/plans/2026-05-30-cli-ux-fixes.md:82:1. P0: `backend start` detach + `backend status` discovery (these are closely related)
./docs/release-notes/v0.2.1.md:13:- **Documentation**: Updated implementation status, PRD, README, and release docs to accurately reflect v0.2.0.
./docs/specs/2026-05-04-openloop-cli-design.md:452:3. Save model status to settings.
./docs/specs/2026-05-04-openloop-cli-design.md:502:  { "variant": "lite", "size_gb": 8, "status": "downloaded", "active": false },
./docs/specs/2026-05-04-openloop-cli-design.md:503:  { "variant": "turbo", "size_gb": 16, "status": "downloaded", "active": true },
./docs/specs/2026-05-04-openloop-cli-design.md:507:    "status": "not_downloaded",
./docs/specs/2026-05-04-openloop-cli-design.md:517:Show backend status and active generation tasks.
./docs/specs/2026-05-04-openloop-cli-design.md:560:      "status": "running",
./docs/specs/2026-05-04-openloop-cli-design.md:705:  ps        Show backend status
./docs/specs/2026-05-04-openloop-cli-design.md:852:- Update implementation-status.md
./docs/specs/event-schema.md:30:Emitted by `backend status/start/stop/restart --json`. The lifecycle envelope fields are merged into the backend status JSON object (single NDJSON line).
./docs/specs/event-schema.md:37:  "phase": "healthy",
./docs/specs/event-schema.md:46:| `phase`     | string         | `starting`, `healthy`, `stopped`, `failed`                      |
```

## Suggested pass

1. Delete completed plans, phase docs, handoffs, archive folders, and duplicate implementation docs.
2. Move future work into the selected issue tracker.
3. Rewrite useful human docs into current-state guides.
4. Keep contracts focused on commands, payloads, events, schemas, endpoints, and env vars.
