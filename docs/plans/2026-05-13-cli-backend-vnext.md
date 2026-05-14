# OpenLoop CLI / 后端通信 — 下一版本开发计划

**目标版本代号：** CLI & Backend vNext（建议在 CHANGELOG 中单列为 *CLI parity + backend lifecycle*）  
**文档日期：** 2026-05-13  
**范围：** 提升 CLI 可用性与可预期性；后端状态与进度对用户**显式、可查询**；取消生成时**完整结束本地引擎进程**、避免孤儿进程；CLI 与 Tauri 命令层**能力对齐**。

## 执行摘要（中文）

本版本把 CLI 当作与 GUI **同等优先**的正式入口：用户不必猜测后端是否已启动、由谁启动、当前进行到哪一阶段。技术上区分 **Owned**（本进程 `spawn` 并持有子进程）与 **Attached**（仅发现端口上已有健康服务），取消生成时在 Owned 路径下**协作取消任务 + `kill`/`wait` 回收子进程**，从设计上消灭本进程造成的孤儿引擎；对外来占用端口则**默认不强杀**，用结构化输出与 `doctor` 指引排障。进度方面统一 **NDJSON/JSON 事件契约**（含 `lifecycle` / `progress` / `error`）。能力上按 `lib.rs` 的 `invoke_handler` 逐项补齐为 `openloop backend|models|generation|files|settings|device` 等子命令树（窗口壳除外），并安排跨进程取消（短期用 DB 标志位轮询等）。全文细节、里程碑、风险与周级排期见下文。

---

## 1. 背景与问题陈述

### 1.1 当前行为摘要

- **模式分流：** 无子参数时启动 GUI；有子参数时走 Rust CLI，不加载 Tauri（符合「无 GUI」预期；macOS Finder 的 `-psn_*` 需在入口层过滤，避免误进 CLI）。
- **后端归属：** `BackendManager` 在**每个进程**内维护 `Option<Child>`。若健康检查发现**端口上已有**引擎在跑，会标记为 `Healthy` 但**不一定**持有 `Child` 句柄，此时本进程无法 `kill` 该子进程。
- **取消语义：** 生成取消依赖进程内 `Arc<AtomicBool>`；`openloop stop` 在**新进程**中执行时与正在跑 `openloop run` 的进程**无共享状态**，对用户表现为「发了信号但什么都没发生」。
- **进度与状态：** `openloop run --json` 已有 NDJSON 事件流，但缺少统一的「后端生命周期」事件与**非生成类**命令的明确输出契约；`ps` 与真实健康/归属关系未完全对齐用户心智。

### 1.2 本版本要达成的用户体验原则

1. **不猜：** 任何依赖后端的命令在执行前后都能从机器可读或人类可读输出中得知：端口、是否本进程启动、健康检查结果、下一步动作。
2. **不猜进度：** 长时间操作（启动后端、下载模型、生成）统一使用**分阶段 + 可解析**的进度模型（见第 4 节）。
3. **取消可预期：** 用户发起「取消生成」后，明确说明将发生什么（例如：终止本客户端持有的引擎子进程、释放端口）；若引擎由**其他实例**启动，行为有明确定义（见第 3 节）。
4. **能力对齐：** CLI 暴露与 `lib.rs` 中 `invoke_handler` 列表等价的业务能力（窗口壳层除外），避免「只能 GUI 做」的死角。

---

## 2. 里程碑与优先级

| 阶段 | 内容 | 依赖 |
|------|------|------|
| **M0** | [x] 契约与文档：事件 schema、退出码、`backend` 子命令树 | 无 |
| **M1** | [x] 后端归属模型 + 终止策略（孤儿进程治理） | M0 |
| **M2** | [x] 取消生成与后端关停联动 + 跨进程取消 | M1 |
| **M3** | [x] 统一遥测输出（人类 / JSON / NDJSON）与 `doctor`/`status` | M0、部分 M1 |
| **M4** | [x] CLI 子命令补齐（对齐 Tauri） | M1–M3 并行可规划接口 |
| **M5** | [x] 测试、发布说明、迁移指南 | 全部 |

建议 **M1 → M2 → M3** 为关键路径；M4 可按子域并行（backend / models / generation / files / settings）。

---

## 3. 后端生命周期与「无孤儿进程」设计

### 3.1 概念：引擎实例的三类状态

建议在实现与文档中统一用语：

| 状态 | 含义 | 本进程能否 `kill` |
|------|------|-------------------|
| **Owned** | 本 `BackendManager` 通过 `spawn` 启动并持有 `Child` | 是 |
| **Attached** | 健康检查发现在配置端口上已有进程，但非本进程 `spawn`（无 `Child`） | 否（除非实现端口/PID 级「协作式关停」） |
| **Stopped** | 端口无健康响应 | — |

### 3.2 取消生成时的目标行为（产品决策 — 写入发行说明）

**默认策略（推荐）：**

1. 用户执行 **取消生成**（CLI 子命令或 GUI 按钮）时：
   - 首先尝试**协作取消** ACE 任务（若 API 支持 cancel/release，优先调用）。
   - 然后：若当前为 **Owned**，执行 `terminate_child()`（已有 `kill` + `wait`），并将状态置为 `Stopped`。
2. 若为 **Attached**：
   - **不默认** `SIGKILL` 未知 PID（避免误杀用户自行启动的其他服务）。
   - 输出明确文案与 JSON 字段，例如：`"backend_ownership": "foreign"`，`"hint": "引擎由其他 OpenLoop 实例或外部进程占用，请在该实例中停止或使用 openloop backend attach --force-stop（需确认）"`。

**可选增强（vNext+ 或配置项）：**

- `OPENLOOP_BACKEND_KILL_FOREIGN=1` 或 `openloop backend stop --force`：在**用户显式确认**后，通过端口解析 PID 并结束进程树（平台相关：macOS `lsof`/`libproc`，Windows 需对应 API）。必须在文档中标明**风险**。

### 3.3 孤儿进程治理专项任务

- [ ] 审计：`openloop run` / `pull` 异常退出、`SIGINT`、超时后 `Child` 是否始终 `wait`。
- [ ] 审计：GUI 退出时是否 `Drop` / 显式 `stop` 后端（若产品希望「关 GUI 不关引擎」需写清；若希望「关 GUI 关引擎」则与 CLI 一致化）。
- [ ] **审计 `BackendManager::Drop` 在 CLI 短命进程下的语义**：当前 `impl Drop for BackendManager` 会调用 `stop()`，导致每次 `openloop run` 退出时 kill 自己启动的后端，下一条命令冷启重来。需明确决策：Owned 后端「随进程退出」、「转交 pid lockfile 由后续进程持续使用」或「仅由 `openloop backend stop` 显式收尾」，三选一后写入发行说明。
- [ ] 引入**可选**监督：例如锁文件记录 `pid` + `started_by=openloop` + `port`，便于 `openloop doctor` 报告「谁占用了端口」。
- [ ] 集成测试：在 CI 中模拟子进程启动后中断父进程，断言无残留监听端口（在沙箱允许的前提下）。

---

## 4. 稳健且明确的「后端通信」与进度 UX

### 4.1 全局输出模式

所有子命令支持（或继承）：

- `--json`：单帧 JSON 结果（适合脚本 `jq`）。
- `--stream`：长时间运行命令的 **NDJSON 事件流**。现有 `run --json` 实际输出 NDJSON，语义错位——正式将其标记为 deprecated，保留一个版本周期后以 `run --stream` 替代。
- 默认人类模式：简短阶段标题 + **可关闭**的 spinner（`NO_COLOR`、`-q`/`--quiet`）。

**M0 前置任务：** 引入 `cli::events` 模块，统一所有 CLI 输出走该模块的 `emit_lifecycle / emit_progress / emit_result / emit_error` 函数，不再在命令层手写 `format!()` 拼 JSON 字符串。

### 4.2 统一事件 Schema（建议 v1）

所有 NDJSON 行遵循：

```json
{ "v": 1, "ts": "ISO8601", "kind": "lifecycle|progress|result|error", "command": "run", ... }
```

**生命周期类 `kind: "lifecycle"` 建议字段：**

- `phase`: `backend_check` | `backend_start` | `backend_owned` | `backend_attached` | `backend_ready` | `backend_stop` | `model_check` | `model_download` | `task_submit` | `task_poll` | …
- `port`: number
- `ownership`: `owned` | `attached` | `unknown`
- `message`: 人类可读一句

**进度类 `kind: "progress"`：**

- `pct`（0–100，可选）、`label`、`detail`（如当前文件名）

**错误类：**

- 与现有 `AppError` 映射一致；附加 `recoverable`、`suggestion`（例如「执行 openloop backend start」）。

### 4.3 命令级要求

| 命令域 | 用户不再「需要猜」的内容 |
|--------|-------------------------|
| `openloop run` | 启动前打印/流式：`port`、`owned/attached`、模型是否已缓存；失败时明确超时阶段 |
| `openloop pull` | 下载前后端是否需启动、当前下载字节/总估算 |
| `openloop ps` / `openloop status` | 与 `backend_status` 一致的结构化字段 + 活跃任务列表与任务来源（若可区分） |
| `openloop doctor` | 环境、端口占用、可执行 sidecar、磁盘、模型目录、最近一次后端日志路径 |

---

## 5. 取消与后端的联动（实现要点）

### 5.1 跨进程取消

- **前置（M0）：** 调研 ACE-Step 是否提供 `/cancel` HTTP 端点；当前 `services/ace_client.rs` 无取消 API。调研结论决定「协作取消」路径是否可行，需在 M0 契约阶段锁定，再进入实现。
- **前置（M1）：** 新增迁移 `002_active_task_cancel.sql`：

  ```sql
  ALTER TABLE active_generation_tasks ADD COLUMN cancel_requested_at TEXT;
  ```

- **短期：** 基于 SQLite 的 **`cancel_requested_at`** 写入 `active_generation_tasks`；`openloop run` 内循环同时检查 DB 标志与进程内 `AtomicBool`，实现跨进程可见取消。
- **中期：** 若 ACE HTTP API 存在 cancel 端点则优先调用，避免仅靠杀进程。
- **长期：** 单写者锁或「任务队列服务」属于更大架构，本计划不强制，仅在附录记录。

### 5.2 取消后杀后端（用户明确要求）

- 在 **Owned** 路径：`cancel` →（协作 API）→ `BackendManager::stop()` → 确认 `Child` 已回收。
- 配置项（建议）：`settings` 或 flag `--kill-backend-on-cancel` 默认 **false**。理由：若 GUI 与 CLI 同时连接同一端口，任意一条 CLI 取消都会导致 GUI 侧引擎中断；用户需显式传入 `--kill-backend` 才触发。GUI 可在设置中单独开关，但默认与 CLI 对齐为「不杀」。

---

## 6. CLI 与 Tauri 能力对齐 — 命令矩阵（下一版本交付）

下列对应 `src-tauri/src/lib.rs` 中 `invoke_handler` 所列命令。**窗口壳** `get_window_shell_state` 不纳入 CLI。

### 6.1 后端 `commands::backend`

| Tauri | 建议 CLI |
|-------|-----------|
| `backend_status` | `openloop backend status`（或并入 `openloop status`） |
| `start_backend` | `openloop backend start` |
| `stop_backend` | `openloop backend stop`（含 `--force` 策略见 3.2） |
| `restart_backend` | `openloop backend restart` |
| `get_backend_logs_path` | `openloop backend logs`（打印路径；`--open` 可选仅 macOS） |
| `clear_backend_cache` | `openloop backend clear-cache`（与 GUI 相同前置 `stop` 逻辑） |

### 6.2 设备 `commands::device`

| Tauri | 建议 CLI |
|-------|-----------|
| `get_device_info` | `openloop device` 或作为 `openloop doctor` 一节 |

### 6.3 文件 `commands::files`

| Tauri | 建议 CLI |
|-------|-----------|
| `reveal_in_finder` | `openloop files reveal <path>`（非 macOS 提示用资源管理器或打印路径） |
| `copy_audio_to` | `openloop files copy <src> <dst>` |
| `file_exists` | `openloop files exists <path>` → 退出码 0/1 |
| `read_generation_audio` | `openloop files read-audio <id|path> [--output -]`（大文件默认写临时路径） |
| `read_generation_waveform` | `openloop files waveform <id|path> [--json]` |
| `delete_generation_file` + `delete_generation_file_and_record` | **合并为** `openloop files unlink <path\|id> [--keep-record]`；默认同时删除 DB 记录，`--keep-record` 仅删文件；避免两条语义相近命令造成混淆 |

### 6.4 设置 `commands::settings`

| Tauri | 建议 CLI |
|-------|-----------|
| `get_settings` | `openloop settings get` / `openloop settings show --json` |
| `set_setting` | `openloop settings set <key> <value>` |
| `reset_runtime_settings` | `openloop settings reset` |
| `get_default_app_paths` | `openloop settings paths` |
| `add_cli_to_path` / `remove_cli_from_path` / `is_cli_in_path` | `openloop settings path [--add|--remove|--check]` |

### 6.5 模型 `commands::models`

| Tauri | 建议 CLI |
|-------|-----------|
| `list_model_catalog` | `openloop models catalog`（与 `models` 列表区分：远端/本地元数据） |
| `get_model_status` | `openloop models status [variant]` |
| `download_model` | 已有 `pull` — **统一别名** `openloop models download <variant>` 或内部复用 |
| `delete_model` | `openloop models delete <variant>` |
| `clear_partial_downloads` | `openloop models clear-partial` |
| `cancel_download` | `openloop models cancel` |
| `delete_all_models` | `openloop models delete-all --yes` |

### 6.6 历史 `commands::history`

| Tauri | 建议 CLI |
|-------|-----------|
| `list_generations` | 已有 `list` — 增加与 IPC 相同过滤/分页 flags |
| `get_generation` | `openloop list --id <uuid>` 或 `openloop history get <id>` |
| `delete_generation` | 已有 `delete` |
| `clear_generation_history` | 已有 `clear` |

### 6.7 生成 `commands::generation`

| Tauri | 建议 CLI |
|-------|-----------|
| `insert_generation` | `openloop history import` 或 `openloop generation insert`（低优先级，面向脚本） |
| `generate_music` | 已有 `run` |
| `cancel_generation` | 重写 `openloop cancel` / `openloop generation cancel [--kill-backend]`，结合 5.1、5.2 |
| `enhance_prompt` | `openloop enhance "<prompt>"` 或 `openloop generation enhance`（与 IPC `enhance_prompt` 命名对齐；不使用 `format` 避免与 `--format` 音频标志混淆） |
| `list_active_generation_tasks` | 并入 `openloop status` / `openloop ps` |
| `resume_generation_task` | `openloop generation resume <id>` |
| `discard_active_generation_task` | `openloop generation discard <id>` |

---

## 7. UX 细则清单（可勾选）

- [ ] 顶层 `openloop help` 按域分组（`backend` / `models` / `generation` / `files` / `settings`）。
- [ ] 所有破坏性操作：`--yes` 或交互确认；`--json` 模式下非交互默认拒绝除非 `--yes`。
- [ ] 退出码约定：`0` 成功；`1` 通用错误；`2` 用法错误；`3` 后端不可用；`4` 用户取消（可选）。实现路径：在 `models/errors.rs` 为 `AppError` 增加 `exit_code() -> i32` 方法，`cli::run` 按返回值分流，不再全部硬编码 `1`。
- [ ] 与 `NO_COLOR`、管道检测（TTY）一致：非 TTY 默认少动画、多结构化。
- [ ] 本地化：CLI 错误信息至少英文稳定键 + 可选 i18n（若项目已有体系则复用）。

---

## 8. 测试与验收

> 注：当前 `src-tauri/tests/cli_contract.rs` 只是 service-layer 烟雾测试，未解析任何 NDJSON 结构；「契约测试」需在 M0 的 `cli::events` 模块落地后才有测试对象。

- **契约测试（M0 完成后开始）：** 扩展 `src-tauri/tests/cli_contract.rs`：解析 NDJSON `v:1` 最小集合，验证 `kind` / `ts` / `phase` 字段存在；`backend status --json` 做 schema snapshot。
- **集成测试：** Fake 端口 / mock health（若已有 harness）；否则文档化手工验收脚本。
- **进程测试：** 启动 Owned 后端 → cancel → 断言端口关闭、无 zombie（平台脚本）。

---

## 9. 文档与发布

- 更新 `docs/specs/2026-05-04-openloop-cli-design.md`：与本文冲突处以 **vNext 行为**为准并加迁移表。特别**废止**原 spec *Backend Coordination* 第 2 段（「Neither CLI nor GUI should kill a backend they didn't start. The backend process persists after the CLI exits.」）——本版本在 Owned 路径下引入了「取消后可 kill」语义，直接与之矛盾。
- CHANGELOG **Breaking 项**：
  - `openloop stop` 语义变更（由「后端停止」改为「取消生成」）；
  - `BackendManager::Drop` / `AppState` CLI 模式下的后端关闭行为（待 3.3 决策后落字）；
  - `openloop run --json` 标记 deprecated，由 `--stream` 接替（NDJSON）。
- 用户可见：「取消生成是否会关闭后端」在帮助与网站 FAQ 中**加粗说明**。

---

## 10. 风险与开放问题

- **多实例：** GUI + CLI 同时连接同一端口时，「杀后端」影响另一方 —— 需在 `lifecycle` 事件中提示所有已连接客户端（长期可做文件锁；短期文档说明）。
- **Attached 强杀：** 安全与权限风险，必须独立 flag 与审计日志。
- **Windows / Linux：** PID 解析与进程树杀死与 macOS 工作量不同，排期按平台分波次。

---

## 11. 建议排期（相对顺序，非绝对人天）

1. **Week 1：** M0 契约 + `backend` 子命令壳 + `status`/`doctor` 骨架  
2. **Week 2：** M1 归属模型 + 终止路径审计 + 测试基线  
3. **Week 3：** M2 取消 + DB 标志 + Owned 杀进程 + 文档  
4. **Week 4–5：** M4 分批交付 models / settings / files / generation  
5. **Week 6：** M5 硬化、性能、发布候选

---

*本计划由代码库当前 `invoke_handler` 与 CLI 实现差距分析整理；实施时以代码审查与产品最终决策为准。*
