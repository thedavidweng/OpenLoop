# OpenLoop Product Requirements Document

**版本**: 1.0  
**状态**: Implementation-Ready  
**最后更新**: 2026-04-23  
**目标平台**: macOS Apple Silicon  
**项目类型**: 开源、本地优先、离线 AI 音乐生成桌面应用  
**内部代号**: OpenLoop  
**主要实现对象**: Codex / Coding Agent / Human Developer

---

## 1. 产品定位

### 1.1 产品一句话

OpenLoop 是一款面向 Apple Silicon Mac 的开源本地 AI 音乐生成桌面应用，用户可以通过文字描述、歌词、时长、BPM 等参数在本机生成音乐，并在本地完成播放、导出和历史管理。

### 1.2 产品愿景

OpenLoop 让创作者在本机完成 AI 音乐生成流程：无需账号、无需订阅、无需上传歌词或创作素材。应用采用 Tauri v2 构建 macOS 桌面客户端，通过本地 ACE-Step 1.5 后端完成音乐生成，并使用 Apple MLX 在 Apple Silicon 上利用 GPU 与统一内存进行推理加速。

OpenLoop 的核心价值是：

- 本地运行：生成过程默认发生在用户设备上。
- 开源透明：应用代码、模型调用方式、数据存储方式可审计。
- 创作者友好：提供接近商业 AI 音乐工具的基础体验。
- 开发者友好：后端、模型路径、任务状态、历史记录均可扩展。

### 1.3 当前版本目标

v0.1 Alpha 的目标是验证完整闭环：

```text
首次设置 → 模型准备 → 文本/歌词生成音乐 → 播放预览 → 导出文件 → 保存历史
```

本版本优先保证可运行、可调试、可恢复、可复现。高级音频编辑、Repaint、多模型管理、Homebrew Cask 分发放入后续版本。

### 1.4 非目标

v0.1 不实现以下能力：

- DAW 级多轨编辑。
- MIDI 编辑。
- 云端同步。
- 账号系统。
- 社交发布。
- 商业版权清算或版权保证。
- Intel Mac 性能优化。
- Windows/Linux 客户端。
- 插件系统。
- LoRA 训练 UI。
- Repaint 正式版。

---

## 2. 用户与使用场景

### 2.1 目标用户

| 用户类型             | 需求                           | OpenLoop 提供的价值              |
| -------------------- | ------------------------------ | -------------------------------- |
| 视频/播客/短片创作者 | 快速生成背景音乐或 demo        | 本地生成、快速导出、无需订阅     |
| 独立音乐人           | 用 AI 生成灵感草稿             | 支持歌词、风格、BPM、seed 复现   |
| 技术用户/开发者      | 在本地运行和调试开源音乐模型   | 模型路径可控、后端透明、开源可改 |
| 注重隐私的用户       | 避免上传歌词、prompt、音频素材 | 默认本地推理、本地历史、本地文件 |

### 2.2 核心用户故事

1. 作为内容创作者，我希望输入“lo-fi, warm, 90 BPM, no vocal”等描述后生成 30 秒音乐，用于视频背景。
2. 作为独立音乐人，我希望输入歌词和风格，生成一首含人声的 demo。
3. 作为开发者，我希望选择本地模型目录，查看生成参数、seed、模型版本，并复现同一首歌。
4. 作为隐私敏感用户，我希望歌词和生成历史只存储在我的电脑上。

---

## 3. 平台与技术约束

### 3.1 支持平台

| 平台                      | v0.1 状态                  | 说明                 |
| ------------------------- | -------------------------- | -------------------- |
| macOS 14+ Apple Silicon   | Required                   | MVP 主平台           |
| macOS 12–13 Apple Silicon | Best Effort                | 可运行性需实测       |
| Intel Mac                 | Unsupported / Experimental | 不作为 v0.1 验收目标 |
| Windows/Linux             | Out of Scope               | 后续再评估           |

### 3.2 硬件分级

| 设备级别                 | 推荐配置         | 默认策略                                            |
| ------------------------ | ---------------- | --------------------------------------------------- |
| Apple Silicon 8 GB RAM   | M1/M2 8GB        | 使用低内存配置，默认关闭 LM thinking 或使用 0.6B LM |
| Apple Silicon 16 GB RAM  | M1/M2/M3 16GB    | 默认启用 turbo DiT + 0.6B LM；可选 1.7B LM          |
| Apple Silicon 24 GB+ RAM | M 系列高内存设备 | 可启用 1.7B LM、高质量参数、更长时长                |

### 3.3 技术栈

| 层级     | 技术选择                                       | 说明                                          |
| -------- | ---------------------------------------------- | --------------------------------------------- |
| 桌面框架 | Tauri v2                                       | Rust 后端 + WebView 前端                      |
| 前端     | React + TypeScript + Vite                      | UI、状态管理、表单、播放器                    |
| 后端管理 | Rust Tauri Commands                            | 进程管理、文件系统、SQLite、API proxy         |
| 推理服务 | ACE-Step 1.5 local API server                  | 本机 HTTP API，作为 sidecar/subprocess 管理   |
| 推理加速 | Apple MLX                                      | Apple Silicon CPU/GPU + unified memory        |
| 依赖环境 | bundled uv-managed Python environment          | 隔离 ACE-Step 运行环境，不依赖用户已安装的 uv |
| 数据库   | SQLite                                         | 生成历史、设置、模型 manifest                 |
| 音频处理 | Native audio element + optional FFmpeg sidecar | MVP 优先播放和 WAV/MP3 导出                   |
| 打包     | Tauri bundler                                  | `.dmg` release                                |

### 3.4 核心架构

v0.1 使用“本地 API server 管理模式”，避免直接解析不稳定 CLI stdout。

```text
React UI
  → Tauri invoke()
    → Rust Backend
      → LocalBackendManager
        → starts/stops ACE-Step API server subprocess
        → polls /health
        → POST /release_task
        → POST /query_result
        → GET /v1/audio
      → stores generated files + metadata
  → UI loads local audio file
```

### 3.5 进程边界

OpenLoop 主应用负责：

- 启动和停止 ACE-Step 本地后端。
- 检查后端健康状态。
- 代理生成请求。
- 轮询任务状态。
- 下载/移动生成音频到用户输出目录。
- 记录生成历史。
- 展示用户友好的错误信息。

ACE-Step 后端负责：

- 模型加载。
- 推理任务排队。
- 音频生成。
- 返回生成结果路径或错误。

---

## 4. 模型与后端集成

### 4.1 后端接口优先级

v0.1 优先使用 ACE-Step local HTTP API。

| 接口                     | 用途                                      |
| ------------------------ | ----------------------------------------- |
| `GET /health`            | 后端健康检查                              |
| `POST /release_task`     | 创建生成任务                              |
| `POST /query_result`     | 查询任务状态                              |
| `GET /v1/audio?path=...` | 下载生成音频                              |
| `GET /v1/models`         | 获取可用 DiT 模型                         |
| `POST /v1/init`          | 初始化或切换模型；v0.1 可只用于启动后验证 |

### 4.2 v0.1 生成参数

#### 基础参数

| UI 字段      | 后端字段          |        类型 | 默认值             | 约束                                     |
| ------------ | ----------------- | ----------: | ------------------ | ---------------------------------------- |
| 风格描述     | `prompt`          |      string | empty              | 建议必填，但允许歌词驱动                 |
| 负面提示词   | `negative_prompt` |      string | empty              | 用于排除不需要的风格或噪音               |
| 歌词         | `lyrics`          |      string | empty              | 支持 `[verse]`、`[chorus]` 等文本结构    |
| 人声语言     | `vocal_language`  |      string | `en`               | 下拉选择：`en`, `zh`, `ja`, `ko`, `auto` |
| 时长         | `audio_duration`  |      number | 30                 | 10–600 秒                                |
| BPM          | `bpm`             | number/null | null               | 30–300                                   |
| Key/Scale    | `key_scale`       |      string | empty              | 可选                                     |
| 拍号         | `time_signature`  |      string | `4`                | 2 / 3 / 4 / 6                            |
| 输出格式     | `audio_format`    |      string | `wav`              | `wav` / `mp3` / `flac`                   |
| 随机种子     | `seed`            |         int | -1                 | 与 `use_random_seed=false` 配合          |
| 使用随机种子 | `use_random_seed` |        bool | true               | seed 模式下 false                        |
| 模型         | `model`           |      string | backend default    | v0.1 默认 turbo                          |
| Thinking     | `thinking`        |        bool | hardware dependent | 8GB 默认 false，16GB+ 默认 true/optional |
| 推理步数     | `inference_steps` |         int | 8                  | turbo 默认 8                             |

#### 高级参数

高级参数 v0.1 可以隐藏在折叠面板中：

| UI 字段        | 后端字段           | 默认  | 说明                              |
| -------------- | ------------------ | ----- | --------------------------------- |
| Guidance Scale | `guidance_scale`   | 7.0   |                                   |
| Use Format     | `use_format`       | false |                                   |
| CoT Caption    | `use_cot_caption`  | true  |                                   |
| CoT Language   | `use_cot_language` | true  |                                   |
| Batch Size     | `batch_size`       | 1     | OpenLoop v0.1 固定为 1 以节省内存 |
| Infer Method   | `infer_method`     | `ode` |                                   |

v0.1 固定 `batch_size=1`，降低内存风险。

### 4.3 本地模型配置

v0.1 提供两个推荐 profile。

| Profile    | 目标设备 | DiT                 | LM               | Thinking 默认 | 说明             |
| ---------- | -------- | ------------------- | ---------------- | ------------- | ---------------- |
| Low Memory | 8GB      | `acestep-v15-turbo` | 0.6B 或 disabled | false         | 优先成功率       |
| Standard   | 16GB+    | `acestep-v15-turbo` | 0.6B             | true optional | 默认推荐         |
| Quality    | 24GB+    | base/turbo 可选     | 1.7B             | true          | 后续版本优先完善 |

### 4.4 模型 Manifest

应用需要维护本地 manifest，用于判断模型状态。

```json
{
  "backend": "ace-step-1.5",
  "backend_version": "0.1.x",
  "profiles": [
    {
      "id": "standard",
      "dit_model": "acestep-v15-turbo",
      "lm_model": "acestep-5Hz-lm-0.6B",
      "min_memory_gb": 16,
      "thinking_default": true
    }
  ],
  "model_dir": "/Users/<user>/Library/Application Support/OpenLoop/models",
  "installed_at": "2026-04-23T00:00:00Z",
  "verified_at": null
}
```

v0.1 的完整性检测至少包含：

- 模型目录存在。
- 后端可以启动。
- `/health` 返回成功。
- `/v1/models` 返回至少一个可用模型。
- 10 秒 dry-run 生成可选，仅在用户手动运行诊断时触发。

---

## 5. 功能需求

## F-01 首次设置向导

### 目标

引导用户完成本地后端环境准备、模型路径设置、设备检测和后端健康检查。

### 用户流程

1. 用户首次打开 OpenLoop。
2. 应用检测 Apple Silicon、macOS 版本、可用内存。
3. 用户选择模型/缓存目录。
4. 应用使用随包 uv sidecar 创建或检测 Python 后端环境。
5. 应用启动 ACE-Step API server。
6. 应用检测 `/health` 与 `/v1/models`。
7. 完成后进入主界面。

### 验收标准

- 首次打开时，若后端环境缺失，展示设置向导。
- 用户可以选择模型目录。
- 应用可以保存模型目录到 settings 表。
- 后端启动失败时显示具体错误和日志路径。
- 健康检查成功后进入主界面。
- 设置过程不会清空已有用户数据。

### 错误处理

| 错误                          | UI 展示                                      |
| ----------------------------- | -------------------------------------------- |
| 非 Apple Silicon              | 显示 unsupported/experimental 提示，允许退出 |
| 内存低于 8GB                  | 显示 unsupported 提示                        |
| 内置 uv / Python 环境创建失败 | 显示失败阶段、stderr 摘要、日志路径          |
| 后端端口被占用                | 提示换端口或关闭占用进程                     |
| 模型缺失                      | 提示选择已有目录或进入下载/安装流程          |

---

## F-02 后端进程管理

### 目标

应用稳定管理 ACE-Step API server 生命周期。

### 需求

- 应用启动时检查后端状态。
- 后端未启动时由 Rust Backend 启动。
- 后端启动后轮询 `/health`。
- 应用退出时停止子进程。
- 后端崩溃时 UI 显示错误，并允许重启。
- 保存后端日志到应用日志目录。

### 验收标准

- 启动后 60 秒内完成健康检查或返回错误。
- 后端崩溃后 UI 进入 `backend_error` 状态。
- 用户点击 “Restart Backend” 后可以重新启动。
- 每次后端启动都有独立日志文件。

---

## F-03 Text-to-Music 生成

### 目标

用户输入 prompt/lyrics/duration 等参数后生成音频文件。

### 生成状态

| 状态               | 含义         |
| ------------------ | ------------ |
| `idle`             | 无任务       |
| `validating`       | 表单校验     |
| `backend_starting` | 后端启动中   |
| `submitting`       | 提交任务     |
| `queued`           | 后端排队     |
| `running`          | 后端生成中   |
| `downloading`      | 下载音频文件 |
| `completed`        | 生成成功     |
| `failed`           | 生成失败     |
| `cancelled`        | 用户取消     |

### 任务流程

```text
Validate form
  → ensure backend healthy
  → POST /release_task
  → save task_id
  → poll /query_result every 2s
  → when status=1, parse result JSON string
  → GET /v1/audio
  → save to output directory
  → insert history row
  → load player
```

### 验收标准

- 输入合法参数后点击 Generate，1 秒内 UI 进入生成状态。
- 同一时间只允许一个活跃生成任务。
- 任务成功后，音频自动出现在播放器。
- 任务失败后，表单内容保留。
- 历史记录保存 prompt、lyrics、duration、seed、model、output_path。
- 支持用户取消本地轮询；v0.1 可不取消后端实际任务，但 UI 必须标记为 cancelled。

### 表单校验

| 字段            | 规则                    |
| --------------- | ----------------------- |
| prompt + lyrics | 两者至少一个非空        |
| duration        | 10–600 秒               |
| bpm             | empty 或 30–300         |
| seed            | empty 或 32-bit integer |
| batch_size      | v0.1 固定 1             |

---

## F-04 再生成与 Seed 复现

### 目标

用户可以基于上一次参数生成变体，也可以复现指定 seed。

### 需求

- “Regenerate” 使用相同参数，设置 `use_random_seed=true`。
- “Reproduce” 使用同一 seed，设置 `use_random_seed=false`。
- 历史记录里显示 seed。
- 从历史记录载入参数时保留 seed。

### 验收标准

- 每次生成后保存后端返回的 seed 值。
- 历史条目可一键载入参数。
- 使用 Reproduce 时请求 payload 包含 `use_random_seed=false` 与 `seed=<value>`。

---

## F-05 播放与预览

### 目标

用户可以直接在应用内播放生成结果。

### 需求

- 播放 / 暂停。
- 进度条拖动。
- 当前时间 / 总时长显示。
- 生成完成后自动加载最新音频。
- 支持系统音频输出。
- MVP 可使用浏览器 audio API。
- 波形 v0.1 可使用简化占位；精细 waveform 放到 v0.2。

### 验收标准

- 生成完成后无需手动导入即可播放。
- 播放器可以加载本地文件路径。
- 文件缺失时显示 “File missing” 并允许从历史中删除记录。

---

## F-06 导出

### 目标

用户可以将生成音频导出到指定目录。

### 需求

- 默认输出目录：用户 Music/OpenLoop 或用户设置路径。
- 支持 WAV 与 MP3。
- FLAC 作为 v0.1 optional。
- 文件名包含时间戳，默认格式：

```text
OpenLoop_YYYYMMDD_HHMMSS_<short-slug>.<ext>
```

- 文件名不得直接包含完整 prompt，避免隐私泄露和非法字符问题。
- 历史记录保存真实输出路径。

### 验收标准

- 用户可以选择导出目录。
- 导出成功后显示路径。
- 文件名合法，兼容 macOS 文件系统。
- 若目标文件已存在，自动追加后缀。

---

## F-07 生成历史

### 目标

本地保存生成记录，便于播放、搜索、复现和清理。

### 数据字段

```sql
CREATE TABLE generations (
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
```

### 需求

- 历史列表按时间倒序。
- 支持搜索 prompt/lyrics。
- 支持删除历史记录。
- 支持仅删除记录或同时删除音频文件。
- 点击历史条目加载播放器。
- 点击 “Use Settings” 载入参数到编辑区。

### 验收标准

- 生成成功后自动插入一条历史。
- 失败任务可选择是否记录；v0.1 默认记录失败任务，便于调试。
- 删除记录不影响其他文件。
- 文件缺失时给出明确状态。

---

## F-08 设置

### 目标

集中管理后端、模型、输出和隐私偏好。

### 设置项

| 设置          | 默认                                |
| ------------- | ----------------------------------- |
| 模型目录      | Application Support/OpenLoop/models |
| 输出目录      | Music/OpenLoop                      |
| 后端端口      | 8001                                |
| 默认输出格式  | wav                                 |
| 默认时长      | 30                                  |
| 默认 Thinking | hardware profile                    |
| 自动播放      | true                                |
| 保存失败任务  | true                                |
| 日志保留天数  | 14                                  |

### 验收标准

- 设置修改后持久化。
- 影响后端启动的设置需要提示重启后端。
- 用户可以打开日志目录。
- 用户可以清除生成历史。
- 用户可以清除后端缓存；此操作需要二次确认。

---

## F-09 Repaint（v0.2 / MVP+）

### 状态

v0.1 实现基础数值输入；v0.2 引入可视化选择。

### 需求

- 输入源音频。
- 选择 repaint start/end。
- **可视化支持 (v0.2)**：在音频播放器波形图上通过拖拽选择重绘区间，自动填入 start/end 秒数。
- 区间范围 3–90 秒。
- 传入 `task_type=repaint`、`src_audio_path`。
- 保留上下文，其余部分尽量保持一致。
- 支持保存为新版本。

---

## 6. 非功能需求

### 6.1 性能目标

所有性能目标分为 cold start 和 warm generation。

| 设备         | 任务                          | 目标                         |
| ------------ | ----------------------------- | ---------------------------- |
| M1/M2 8GB    | 10s audio, low-memory profile | 应成功完成                   |
| M1/M2 8GB    | 60s audio, low-memory profile | Best effort                  |
| M2/M3 16GB   | 30s audio, standard profile   | ≤ 60s warm generation target |
| M3 Pro 18GB+ | 60s audio, standard profile   | ≤ 60s warm generation target |

性能验收必须记录：

- 设备型号。
- macOS 版本。
- RAM。
- DiT model。
- LM model。
- thinking true/false。
- duration。
- inference_steps。
- cold start time。
- generation time。
- peak memory if available。

### 6.2 隐私

- 除模型下载和用户主动打开外部链接外，应用不发出网络请求。
- 不收集遥测。
- 不创建账号。
- 不上传 prompt、lyrics、生成音频。
- 历史记录保存在本地 SQLite。
- 音频文件保存在用户指定目录。
- 日志不得保存完整歌词，默认只保存错误摘要和 task id。

### 6.3 安全

- 后端 API 只绑定 `127.0.0.1`。
- 后端端口可配置。
- 不开放局域网访问。
- 文件路径必须做 allowlist/sandbox 范围控制。
- 导出文件名必须 sanitize。
- Tauri shell/sidecar 权限最小化配置。
- 不允许前端执行任意 shell command。

### 6.4 可靠性

- 后端启动失败可恢复。
- 模型目录缺失可重新指定。
- 生成失败不清空表单。
- 应用崩溃后历史数据库保持一致。
- 生成任务状态需落库，避免只存在内存里。

### 6.5 可访问性

- 支持键盘操作。
- 支持深色/浅色模式。
- 按钮具有明确 disabled/loading 状态。
- 错误信息可读。
- 进度状态使用文本与视觉状态共同表达。

---

## 7. UI/UX 规范

### 7.1 布局

v0.1 使用三栏结构。

```text
┌─────────────────────────────────────────────────────────────┐
│ Sidebar: History │ Main: Generation Form │ Preview / Output │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 左侧：历史记录

包含：

- 搜索框。
- 生成记录列表。
- 状态标记：success / failed / missing file。
- 时间、时长、简短 prompt。
- 右键菜单：Use Settings、Reveal in Finder、Delete Record、Delete Record and File。

### 7.3 中间：生成参数

包含：

- Prompt textarea。
- Lyrics textarea。
- Duration slider + numeric input。
- BPM input。
- Language select。
- Output format select。
- Seed controls。
- Advanced disclosure。
- Generate / Cancel button。

### 7.4 右侧：预览输出

包含：

- 当前生成状态。
- 进度描述。
- 播放器。
- 文件信息。
- Export / Reveal in Finder 按钮。
- 错误详情折叠区。

### 7.5 状态文案

| 场景     | 文案                              |
| -------- | --------------------------------- |
| 后端启动 | Starting local generation engine… |
| 模型加载 | Loading local model…              |
| 排队     | Task queued…                      |
| 生成中   | Generating audio…                 |
| 下载     | Saving audio file…                |
| 成功     | Generation complete               |
| 失败     | Generation failed                 |
| 后端错误 | Local backend is unavailable      |

---

## 8. 数据模型

### 8.1 settings

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 8.2 generations

见 F-07。

### 8.3 backend_events

```sql
CREATE TABLE backend_events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  level TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata_json TEXT
);
```

---

## 9. 错误码规范

Rust 后端统一返回结构：

```ts
type AppError = {
  code: string;
  message: string;
  details?: string;
  recoverable: boolean;
};
```

### 常见错误码

| Code                     | 场景                         | Recoverable |
| ------------------------ | ---------------------------- | ----------- |
| `UNSUPPORTED_DEVICE`     | 非 Apple Silicon 或 RAM 不足 | false       |
| `BACKEND_NOT_INSTALLED`  | 后端环境缺失                 | true        |
| `BACKEND_START_FAILED`   | 后端启动失败                 | true        |
| `BACKEND_HEALTH_TIMEOUT` | 健康检查超时                 | true        |
| `MODEL_NOT_FOUND`        | 模型缺失                     | true        |
| `TASK_SUBMIT_FAILED`     | `/release_task` 失败         | true        |
| `TASK_FAILED`            | 生成失败                     | true        |
| `AUDIO_DOWNLOAD_FAILED`  | 结果文件下载失败             | true        |
| `OUTPUT_WRITE_FAILED`    | 写入导出目录失败             | true        |
| `DB_WRITE_FAILED`        | 历史记录写入失败             | true        |

---

## 10. 开源、授权与责任声明

### 10.1 应用授权

OpenLoop 应用代码使用 MIT License。

### 10.2 模型授权

模型和推理后端遵循 ACE-Step upstream license。应用仓库必须清楚区分：

- OpenLoop app code license。
- ACE-Step code/model license。
- 第三方依赖 license。
- FFmpeg license，如使用。

### 10.3 生成内容声明

OpenLoop 不承诺生成内容天然无版权风险。应用需要在 About 或首次设置中提示：

- 用户需要自行判断生成内容是否适合商用。
- 用户应避免输入受保护歌词、旋律、声音或明确模仿受保护艺术家的素材。
- 用户发布生成内容时应按当地法规和平台规则披露 AI 参与。
- 应用不提供版权清算、相似性检测或法律意见。

---

## 11. 发布策略

### 11.1 v0.1 Alpha

交付：

- GitHub source release。
- `.dmg` for Apple Silicon。
- 明确标注 Alpha。
- README 包含安装步骤、硬件要求、已知问题。
- 不默认承诺 Intel Mac 支持。

### 11.2 v0.2 Beta

目标：

- Repaint 初版。
- 更完整模型管理。
- 更稳的下载器。
- 基于波形的 Repaint 区间选择。
- 可选 Homebrew Cask。
- 自动更新机制评估。

### 11.3 v1.0

目标：

- 稳定安装/更新。
- 可恢复后端。
- 完整隐私说明。
- 公证签名。
- 基础文档完整。

---

## 12. 里程碑

| 阶段 | 目标     | 交付物                                       | 验收                  |
| ---- | -------- | -------------------------------------------- | --------------------- |
| M0   | 技术验证 | Tauri app 启动 ACE-Step 后端，生成 10 秒音频 | 本地生成成功并可播放  |
| M1   | MVP 闭环 | 设置、生成、播放、导出、历史                 | 完整用户流程可跑通    |
| M1.5 | 稳定化   | 错误处理、日志、seed 复现、文件缺失处理      | 手动测试清单通过      |
| M2   | Beta     | Repaint、模型管理、性能优化                  | Beta release          |
| M3   | v1.0     | 签名、公证、文档、发布流程                   | Public stable release |

---

## 13. 测试计划

### 13.1 单元测试

- 参数校验。
- 文件名 sanitize。
- settings read/write。
- generations insert/update/delete。
- API response parser。
- error mapping。

### 13.2 集成测试

- Backend start/health check。
- Submit generation task mock。
- Poll task result mock。
- Download audio mock。
- Write history.
- Load history into form.

### 13.3 手动测试

| 测试               | 预期                          |
| ------------------ | ----------------------------- |
| 首次启动           | 显示设置向导                  |
| 后端缺失           | 显示安装/配置提示             |
| 模型缺失           | 显示模型目录提示              |
| 10 秒生成          | 成功保存音频                  |
| 取消任务           | UI 停止轮询，状态为 cancelled |
| 删除文件后打开历史 | 显示 file missing             |
| 输出目录无权限     | 显示可恢复错误                |
| 重启应用           | 历史仍存在                    |
| 后端崩溃           | UI 显示 backend error         |

---

## 14. Definition of Done

v0.1 达成条件：

- Apple Silicon Mac 上可以完整执行首次设置。
- 可以生成至少 10 秒音频。
- 生成结果可以在应用内播放。
- 生成结果可以保存到用户输出目录。
- 历史记录可以展示并重新加载参数。
- 后端失败、模型缺失、输出失败均有明确错误提示。
- README 包含硬件要求、安装步骤、隐私说明、已知限制。
- 不出现“神经引擎加速”“Intel Mac 完整支持”“无版权风险”等未经验证承诺。
