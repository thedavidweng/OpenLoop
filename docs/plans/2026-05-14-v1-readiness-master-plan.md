# OpenLoop v1 Readiness — 主执行计划

**文档日期：** 2026-05-14
**作者：** Review-driven master plan（由 2026-05-13 全量评审产出）
**范围：** 把 v0.1.x Alpha 推到具备「可正式公开发布 + 具备商业化雏形」状态所需的全部工作。
**目标版本节点：**

| 版本 | 时间窗口 | 目标 |
|------|----------|------|
| `v0.1.x` 维护版 | T+0 ~ T+2 周 | 发布阻塞项（签名、CSP、模型校验、自动更新） |
| `v0.2.0` | T+2 ~ T+6 周 | 体验重构 + 代码拆分 + 错误链路 + 可访问性 |
| `v0.3.0` | T+6 ~ T+10 周 | E2E、可观测性、Project 概念、对比试听 |
| `v0.4.0 / v1.0-rc` | T+10 ~ T+14 周 | 商业化雏形：决策书 + Repaint / Stem / 跨平台预研 |

> 文档下半部按 **Phase（阶段）→ Task（任务）→ Files（涉及文件）→ Acceptance（验收）** 展开。
> 每个 Phase 末尾都有「**P 优先级 / 依赖**」表。可作为后续 `/gsd-plan-phase` 的直接输入。

---

## 0. 全文索引

| Phase | 主题 | 关键交付物 |
|-------|------|------------|
| **P1** 发布阻塞项 | 签名、公证、CSP、模型完整性、自动更新 | 可放心给陌生人安装的 DMG |
| **P2** 安全与可信任度 | 网络白名单、Updater 签名、依赖审计、Privacy Policy | 通过 Vercel/Apple/企业用户初轮审查 |
| **P3** 代码拆分与可维护性 | `store.ts`、`GenerationPanel`、`SettingsOverlay`、`model_manager.rs` | 单文件 < 500 行，模块清晰 |
| **P4** 主表单 UX 重构 | 三层折叠、Sticky CTA、Prompt 历史、灵感库 | 新用户能在 60 秒内完成首次生成 |
| **P5** 历史与多结果体验 | 收藏、对比、批量、失败归档 | 高频用户场景留存 |
| **P6** 播放器与导出 | Loop / AB / 拖入 DAW / 误删保护 | 创作工作流可串联 |
| **P7** 设置页重构 | 分子节卡片、立即生效提示、Danger Zone | 减少配置疑惑 |
| **P8** 首次设置体验 | ETA、网络降级、镜像选择、共享 pack 解释 | 首跑漏斗率提升 |
| **P9** 错误与反馈链路 | Copy diagnostics、GitHub issue 预填、in-app changelog | issue 质量倍增 |
| **P10** 可访问性 / 国际化 | WCAG AA、aria、快捷键面板、i18n 覆盖审计 | 通过基本可访问性审 |
| **P11** 可观测性 | tracing / NDJSON 一致化、本地日志查看器 | 排障可自助 |
| **P12** 测试矩阵 | E2E、性能基准、迁移测试、视觉回归 | 发版信心 |
| **P13** 跨平台预研 | Windows / Linux / Intel Mac 适配评估 | 平台路线图 |
| **P14a** Project 概念（核心） | Project 数据模型、侧栏分组 | 摆脱「单 prompt 单 clip」工具感 |
| **P14b** 产品探索（可选） | Repaint、Stem、MIDI、模型市场 | 根据战略优先级挑选 |
| **P15** 合规与运营 | Privacy / ToS / EULA / 模型 license 清单 / 客服 | 合规可上 App Store / 企业部署 |
| **P16** 商业化决策 | PROJECT_STRATEGY.md、Pro / Cloud / Marketplace 抉择 | 后续投入方向确定 |

---

## 0.1 Phase 依赖关系

```
P1 ──┬─────────────────────────────────┬──────────────────────┬───────────────────┬─────────┬───────┫
   ├──▶ P2 (并行)                      │                      │                   │         │       ┃
   └──▶ P3 ─┬─▶ P4 (依赖 P3.2)         │                      │                   │         │       ┃
             ├─▶ P7 (依赖 P3.3)         │                      │                   │         │       ┃
             └─▶ P12.4 视觉回归基线       │                      │                   │         │       ┃
                (依赖 P3+P4+P7 UI 完成)  │                      │                   │         │       ┃
   P5 ───────────────────────────────┴──────────────────────┴──▶ P14a (协调 DB schema)  │         │       ┃
   P8 (受益于 P1.3 镜像完成)                                                          │         │       ┃
   P11.1 tracing ──▶ P9.1 diagnostics                                                 │         │       ┃
   P6 / P10 / P13 / P15 (独立)                                                         │ P14b    │       ┃
   P16 (独立，不阻塞工程) ─────────────────────────────────────────────────┴─────────┴───────┻
```

**关键路径：** P1 → P3 → P4 → P12.4（视觉回归基线）

---

## 1. Phase 1 — 发布阻塞项（必做，T+0 ~ T+2 周）

### 1.1 开源分发架构与 Gatekeeper 说明（Ad-hoc 签名）

**目标：** 作为开源软件，目前不引入需要付费的 Apple Developer ID，采用 Ad-hoc 本地签名与明确的 Gatekeeper 绕过指引，确保技术用户能顺利安装。

**任务清单：**

- [x] 1.1.1 明确 `src-tauri/tauri.conf.json` 中 macOS 平台的打包策略，不配置外部证书，保留默认的 Ad-hoc 签名。
- [x] 1.1.2 新建 `src-tauri/macos/entitlements.plist`，明确包含 MLX 运行所需的权限配置，保证本地构建和运行稳定：
  - `com.apple.security.cs.allow-jit`
  - `com.apple.security.cs.allow-unsigned-executable-memory`（MLX 与内嵌 Python 环境需要）
  - `com.apple.security.network.client`（允许 HF 下载与本地 backend HTTP）
  - `com.apple.security.cs.disable-library-validation`（避免依赖的第三方 dylib 加载受阻）
- [x] 1.1.3 修改 `src-tauri/tauri.conf.json` 引用该 entitlements 文件。
- [x] 1.1.4 在 `.github/workflows/release.yml` 中配置标准的 Tauri build 打包流程，产出 DMG 文件。
- [ ] 1.1.5 在 `README.md` 与 Release Notes 模板中增加「macOS 安装与打开指南」段落，明确指导用户使用 `右键 -> 打开` 或终端运行 `xattr -cr /Applications/OpenLoop.app` 绕过 Gatekeeper 提示。

**涉及文件：**
- `.github/workflows/release.yml`
- `src-tauri/tauri.conf.json`
- `src-tauri/macos/entitlements.plist`（新建）
- `README.md`
- `docs/release.md`（补充 Gatekeeper 绕过说明）

**验收：** GitHub Action 能顺利打出 DMG 包，且通过说明文档用户可正常运行应用，不闪退。

**风险：** 无需等待证书，但 entitlements 遗漏会导致 MLX 环境在不同机器上崩溃。

---

### 1.2 CSP 锁紧

**目标：** Tauri WebView 不再"完全裸奔"。

**改动：**

```json
// src-tauri/tauri.conf.json
"security": {
  "csp": "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob: tauri:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ipc: http://ipc.localhost http://127.0.0.1:* http://localhost:*; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"
}
```

**任务：**

- [x] 1.2.1 替换 `csp: null`。（已实现于 `tauri.conf.json:27`）
- [x] 1.2.2 跑 `pnpm tauri dev`，逐个 console error 加白名单。
- [x] 1.2.3 若 Tailwind 4 注入需要更宽松 `style-src`，确认是否能去掉 `'unsafe-inline'`（理想是用 nonce）。——保留 `'unsafe-inline'`，Tauri 2 + Tailwind 4 现阶段必需。
- [ ] 1.2.4 文档化最终 CSP 到 `docs/adr/0003-content-security-policy.md`。

**风险：** Tauri 内部 IPC 协议 `tauri://` 与 `ipc:` 在不同版本可能要求不同 connect-src；锁紧后必须完整跑通 happy path 才能合入。

---

### 1.3 模型下载完整性校验 + 镜像源

**目标：** 模型权重下载失败可恢复、可校验、可换源。

**任务：**

- [x] 1.3.1 在 `src-tauri/src/services/model_manager.rs` 中为每个 `AceModelDescriptor` 增加 `files: &[ModelFileSpec { path, sha256, size_bytes }]` 字段（manifest 内嵌或读自 `src-tauri/resources/models.manifest.json`）。——已实现于 `services/model_manager/specs.rs`
- [~] 1.3.2 下载完成时计算 SHA256，与 manifest 比对；不一致 → 删除 `.openloop-part` 与目标文件，返回 `MODEL_INTEGRITY_MISMATCH` 错误。——逻辑已存在（`verify_sha256`），但所有 `spec.sha256` 仍为 `None`，需填入实际哈希值才能生效。
- [~] 1.3.3 抽象 `HF_RESOLVE_BASE` 为可配置 `model_mirrors: Vec<String>` 设置项，默认值：——当前仅支持单镜像配置，未实现多镜像列表。
  - `https://huggingface.co`
  - `https://hf-mirror.com`
  - `https://modelscope.cn/models`（路径需 mapping）
- [ ] 1.3.4 下载失败 → 自动切到下一个镜像；UI 显示当前镜像名。
- [x] 1.3.5 `AppSettings` 增加 `modelMirror?: string`，Settings 页 Advanced 暴露选择器。——已实现于 `models/settings.rs` 和 `SettingsOverlay`。
- [x] 1.3.6 CLI：`openloop pull <variant> --mirror hf-mirror`。——已实现于 `cli/pull.rs`。

**涉及文件：**
- `src-tauri/src/services/model_manager.rs`（核心）
- `src-tauri/src/models/settings.rs`
- `src-tauri/resources/models.manifest.json`（新建，由发布脚本生成）
- `src/app/components/settings/SettingsOverlay.tsx`
- `src/app/lib/model-packs.ts`
- `docs/release.md`

**验收：**
- 单元测试：构造 SHA256 不匹配的下载 → 抛 `MODEL_INTEGRITY_MISMATCH`。
- 手动测试：断网切换镜像后下载继续。



---

### 1.4 自动更新（Tauri Updater）

**目标：** 用户安装一次后能持续拿到补丁版本。

**任务：**

- [x] 1.4.1 加入 `tauri-plugin-updater`：——已实现于 `Cargo.toml:38`
  ```toml
  # src-tauri/Cargo.toml
  tauri-plugin-updater = "2"
  ```
- [x] 1.4.2 生成 updater 签名密钥对：——公钥已写入 `tauri.conf.json:62`，私钥需放 GitHub Secret `TAURI_SIGNING_PRIVATE_KEY`（运维配置）。
  ```bash
  tauri signer generate -w ~/.tauri/openloop.key
  ```
  公钥写入 `tauri.conf.json` `plugins.updater.pubkey`；私钥放 GitHub Secret `TAURI_SIGNING_PRIVATE_KEY`。
- [ ] 1.4.3 发布 workflow 上传 `latest.json`。
- [~] 1.4.4 启动后检查更新；新版本提示模态：——`UpdateBanner` 已存在 (`components/bootstrap/UpdateBanner.tsx`)，但 UI 较简单，未实现完整模态交互。
- [ ] 1.4.5 Settings → General 增加 "Check for updates automatically" toggle，默认开。
- [ ] 1.4.6 CLI：`openloop --version --check-update`。

**涉及文件：**
- `src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`
- `src-tauri/src/lib.rs`（注册 plugin）
- `src/app/lib/api.ts`、`src/app/components/common/UpdateBanner.tsx`（新建）
- `.github/workflows/release.yml`

**验收：** 在本地修改版本号为 `0.1.99`，托管一个 fake `latest.json`，应用启动后看到更新提示。

---

### 1.5 README 平台 badge 修正

**任务：**

- [x] 1.5.1 `README.md` 第 16 行 badge 改为 `platform-macOS%20%28Apple%20Silicon%29-lightgrey`。——已匹配。
- [ ] 1.5.2 在 README 顶部加一行 `> **Status:** v0.1 Alpha — macOS Apple Silicon only. Windows / Linux on the roadmap.`
- [ ] 1.5.3 同步 `README_CN.md`。



---

**Phase 1 汇总表**

| 任务 | P | 依赖 |
|------|---|------|
| 1.1 开源分发与签名 | P0 | — |
| 1.2 CSP | P0 | — |
| 1.3 模型完整性 + 镜像 | P0 | — |
| 1.4 自动更新 | P0 | — |
| 1.5 README 平台 | P0 | — |

全部完成即可释出 `v0.1.2`（首个真正可对外的版本）。

---

## 2. Phase 2 — 安全与可信任度（T+1 ~ T+3 周，部分与 P1 并行）

### 2.1 网络白名单与"本地优先"承诺一致化

- [ ] 2.1.1 在 `tauri.conf.json` 的 `app.security` 内增加 `dangerousDisableAssetCspModification: false`。
- [ ] 2.1.2 审计所有 `reqwest` 调用，确认 URL 来自 manifest / settings，不存在硬编码任意外网。
- [ ] 2.1.3 在 About 页面新增 "Network activity log"：本会话的所有出站请求摘要（host + 用途 + 字节数）。
- [ ] 2.1.4 文档：`docs/adr/0004-network-trust-boundary.md`。

### 2.2 npm / cargo 依赖审计常态化

- [ ] 2.2.1 CI 内已存在 `pnpm audit --audit-level=high`；增加 `cargo install cargo-audit` 后跑 `cargo audit --deny warnings`。
- [ ] 2.2.2 配置 Dependabot：`.github/dependabot.yml` 覆盖 `cargo`、`npm`、`github-actions`、`docker`（若后续引入）。
- [ ] 2.2.3 每月一次 manual review，记录到 `docs/security-log.md`。

### 2.3 隐私页与遥测开关

- [ ] 2.3.1 新建 `docs/privacy.md`（中英双语）：列出"本地只存什么、什么时候联网、第三方组件"。
- [ ] 2.3.2 SetupScreen 第 1 步加链接到 privacy。
- [ ] 2.3.3 即使 v0.1 不引入 telemetry，settings 也预留 "Anonymous error reports（off）" 开关位（默认 off + 灰），为未来 P9 做铺垫。

**Phase 2 验收：** `cargo audit` 与 `pnpm audit` 在 CI 中绿通；`docs/privacy.md` 中英双语存在且 SetupScreen 链接可点击。

---

## 3. Phase 3 — 代码拆分与可维护性（T+2 ~ T+4 周）

### 3.1 拆分 `store.ts`（1096 行）

**目标拆分：**

```
src/app/lib/
├── store/
│   ├── index.ts            ← create() 与组合 slice
│   ├── slices/
│   │   ├── settings.ts     ← settings、hydrate、language、setting setter
│   │   ├── generation.ts   ← form、validation、runGeneration、cancelGeneration、enhance
│   │   ├── history.ts      ← history、currentGeneration、delete、clear、load settings
│   │   ├── model.ts        ← modelStatuses、bootstrapStatus、download/delete/cancel
│   │   ├── ui.ts           ← sidebar、settings overlay、setupOverride、playback toggle
│   │   └── tasks.ts        ← activeTasks、resume、discard ← 仍内嵌在 generation.ts，未独立 slice
│   └── events.ts           ← applyGenerationEvent、applyModelStatus
```

**任务：**

- [x] 3.1.1 用 Zustand slice 模式：`type GenerationStore = SettingsSlice & GenerationSlice & ...`。——已实现于 `store/index.ts` 与 `store/types.ts`。
- [~] 3.1.2 每个 slice 文件 < 250 行；保持向后兼容 selector 命名。——`generation.ts` 386 行，`model.ts` 274 行，略超目标。
- [ ] 3.1.3 现有 `tests/unit/store.test.ts` 必须全部通过，不允许改测试期望。
- [ ] 3.1.4 新增 `tests/unit/slices/*.test.ts`：每个 slice 至少 2 个独立用例。

### 3.2 拆分 `GenerationPanel.tsx`（943 行）

**实际结构：**

```
src/app/components/generation/
├── GenerationPanel.tsx          ← 拆分为 GenerationPanel/ 子目录
│   ├── index.tsx                ← orchestrator ~190 行
│   ├── Header.tsx               ← Prompt + Dice + Wand + 历史/收藏 chips
│   ├── FormBody.tsx             ← Lyrics + Musical + Tweak + Expert 折叠区
│   ├── ActionFooter.tsx         ← Cancel/Reset/Retry + Generate 按钮
│   └── shared.tsx               ← 通用常量和类型
└── hooks/
    └── （尚未提取独立 hooks）
```

**任务：**

- [~] 3.2.1 提取 `useGenerationForm()` 把 store 选择器集中。——未提取独立 hook，状态读取分散在各组件。
- [~] 3.2.2 `SubmitFooter` 用 `position: sticky; bottom: 0` 配合外层 `overflow-auto` 实现 CTA 常驻。——ActionFooter 已独立，但外层容器未使用 sticky 布局，CTA 随页面滚动。
- [~] 3.2.3 字段 props 用具名解构，禁止透传 `form` 整体。——FormBody 内部字段仍部分透传，未完全解耦。
- [ ] 3.2.4 视觉与行为 0 回归，由 P12 视觉回归测试守护。

### 3.3 拆分 `SettingsOverlay.tsx`（804 行）

**实际结构：**

```
src/app/components/settings/
├── SettingsOverlay.tsx          ← 仍 804 行，未拆分为 sections
├── SettingsOverlay/
│   ├── DirectoryPickerRow.tsx
│   ├── ModelPackCard.tsx
│   ├── ModelVariantCard.tsx
│   └── StateBadge.tsx
├── SettingsDialogHost.tsx
└── SettingsSectionCard.tsx
```

- [x] 3.3.1 Save 按钮提升为 sticky header（带 unsaved changes 指示）。——已实现于 `SettingsOverlay.tsx:692`，含 Discard/Save 按钮和 amber 指示器。
- [x] 3.3.2 DangerZone 加红色描边 + Icon。——已实现，`SettingsSectionCard` 支持 `tone="danger"`，按钮带红色边框。

### 3.4 拆分 `model_manager.rs`（1257 行）

**实际结构：**

```
src-tauri/src/services/model_manager/
├── mod.rs              ← 1257 行，远超 400 行目标
├── specs.rs            ← ModelFileSpec + 常量定义
└── types.rs            ← 共享类型
```

- [ ] 3.4.1 单文件 < 400 行。——`mod.rs` 1257 行，需进一步拆分为 download.rs / delete.rs / events.rs / mirror.rs。
- [ ] 3.4.2 `cargo test` 全绿；新增 `mirror.rs` 单测。

**Phase 3 验收：** 所有拆分后文件 < 500 行；`pnpm test:run` 与 `cargo test` 全绿；现有 `tests/unit/store.test.ts` 未修改期望值。

---

## 4. Phase 4 — 主表单 UX 重构（T+3 ~ T+5 周，依赖 P3.2）

### 4.1 三层折叠 + 术语降级

- [x] 4.1.1 "Advanced controls" 重命名为 "**Tweak the sound**"，描述："Optional adjustments to inference, style, and seed."——已实现于 `FormBody.tsx:366`
- [x] 4.1.2 新建 "**Expert（ACE-Step internals）**" 折叠，默认折叠，置入：`useCotCaption`、`useCotLanguage`、`constrainedDecoding`、`lmBackend`、`lmModelPath`、`useFormat`、`thinking`、`inferenceSteps`、`guidanceScale`。——已实现于 `FormBody.tsx:533`
- [x] 4.1.3 Expert 区顶部加灰色说明："These map directly to ACE-Step 1.5 parameters. Most users don't need to change them."——已实现于 `FormBody.tsx:548`
- [x] 4.1.4 i18n key 新增：`generation.tweakSound`、`generation.expertMode`、`generation.expertModeHint`。——已实现。

### 4.2 Sticky Submit Footer

- [ ] 4.2.1 表单容器 `<div class="flex flex-col h-full">`，可滚动区 `flex-1 overflow-auto`，footer `sticky bottom-0`。
- [ ] 4.2.2 footer 渐变背景 `bg-gradient-to-t from-[var(--color-surface)]` 避免内容硬切。

### 4.3 Prompt 历史 / 收藏

- [x] 4.3.1 `AppSettings` 增加 `recentPrompts: string[]`（上限 20，去重保序）。——已实现于 `store/slices/settings.ts:30`
- [x] 4.3.2 提交成功时 push；UI 在 prompt 输入框上方加一行 chip 列表（最近 6 条），可点击填入。——已实现于 `Header.tsx:39-52`
- [x] 4.3.3 Dice 按钮旁加 ⭐ 图标，把当前 prompt 加到 `favoritePrompts`，独立列表（上限 50）。——已实现于 `Header.tsx:40-41`
- [ ] 4.3.4 CLI：`openloop run --from-history N`（用 `openloop list --json` 的 id 引用）。

### 4.4 灵感库扩展

- [x] 4.4.1 `src/app/data/prompt_examples.json` 从 N 条扩到 ≥ 100 条，分类（lo-fi、cinematic、pop、ambient、edm、jazz、orchestral、game-bgm、rnb）。——当前 110 条，9 个分类。
- [ ] 4.4.2 Dice 按钮长按或右键弹分类菜单。
- [ ] 4.4.3 i18n 中文版同步翻译每个示例的中文描述（不替换 prompt 本身，只翻译类目）。

**Phase 4 验收：** 三层折叠 UI 截图回归通过；Prompt 历史 chip 列表可点击填入；灵感库 ≥ 100 条且按分类可筛选；i18n key 无缺失（`scripts/i18n-audit.mjs` 通过）。

**灵感库扩展质量标准（4.4）：** 使用 LLM 批量生成初稿 → 人工筛选 → 每条必须在 ACE-Step 上试听通过，确保可生成合理音频。来源与生成方法记录在 `src/app/data/README.md`。

---

## 5. Phase 5 — 历史与多结果体验（T+4 ~ T+7 周）

### 5.1 收藏 / 置顶

- [ ] 5.1.1 `generations` 表增加列 `is_favorite INTEGER DEFAULT 0`（migration `003_add_favorite.sql`）。——当前仅在内存中通过 `favoriteRecordIds` 维护，未持久化到 DB。
- [~] 5.1.2 `GenerationRecord` 增加 `isFavorite` 字段。——前端 `GenerationRecord` 无 `isFavorite` 字段，靠 `favoriteRecordIds` 数组维护。
- [x] 5.1.3 History 行右侧加 ⭐ 按钮；侧栏顶部加 toggle "Show favorites only"。——已实现。
- [x] 5.1.4 排序：favorites 永远在前，按 createdAt desc。——已实现。

### 5.2 对比试听（A/B Compare）

- [ ] 5.2.1 History 行支持多选（Shift+Click / Cmd+Click），最多 2 条。
- [ ] 5.2.2 PlaybackBar 进入 "Compare" 模式：左右两个迷你播放器并排 + 一个 "Sync play / Toggle A↔B" 按钮。
- [ ] 5.2.3 新建 `src/app/components/player/ComparePlayer.tsx`。
- [ ] 5.2.4 键盘：`1` / `2` 在 A / B 之间切换，空格统一播放。

### 5.3 失败任务归档

- [ ] 5.3.1 新建 `failed_runs` 表（不进 `generations`）：`id`、`createdAt`、`request_json`、`error_code`、`error_message`、`error_details`。
- [ ] 5.3.2 失败时写入；保留最近 50 条。
- [ ] 5.3.3 History 侧栏底部加 "Failed runs (N)" 折叠抽屉；点击 → 显示错误 + "Retry"、"Open in form"、"Copy diagnostics"。
- [ ] 5.3.4 与 CONTEXT.md 一致：明确"Failed runs 不属于 History"。CONTEXT.md 补充一段关于 `failed_runs` 的术语。

### 5.4 批量操作

- [ ] 5.4.1 History 多选模式 + 选中条数 toolbar：Delete / Export to folder / Mark as favorite。
- [ ] 5.4.2 二次确认与 CONTEXT.md 现有规则一致。

**Phase 5 验收：** E2E 测试覆盖：多选 2 条历史 → 进入 Compare 模式 → 同步播放；收藏 toggle 持久化（重启后保留）；`failed_runs` 表最近 50 条约束生效。

> **注意：** P5.2（A/B Compare）与 P6.1（Loop/AB-Loop）都在操作 PlaybackBar，应避免同时开发以减少冲突。

---

## 6. Phase 6 — 播放器与导出（T+5 ~ T+7 周）

### 6.1 Loop / AB-Loop

- [x] 6.1.1 PlaybackBar 加 Loop 按钮（普通 loop）。——已实现（commit `5a0ee8a`）。
- [ ] 6.1.2 波形条上 Shift+Click 设定 A 点，再次 Shift+Click 设定 B 点；自动在 A/B 间循环。
- [ ] 6.1.3 ESC 或重复点击清除 AB 区间。

### 6.2 拖入 DAW / 第三方

- [ ] 6.2.1 macOS：使用 `NSPasteboardItem` `kUTTypeFileURL` 实现可拖出当前音频文件到 Finder / Logic / Ableton。
- [ ] 6.2.2 新建 Rust IPC `prepare_drag_payload(generationId)`，返回临时硬链接路径。
- [ ] 6.2.3 前端通过 `DataTransfer` 提供 `text/uri-list` 给浏览器降级路径。

### 6.3 误删保护

- [ ] 6.3.1 PlaybackBar 中删除按钮移入 overflow 菜单（三点）。
- [ ] 6.3.2 单条删除依旧二次确认，但移除"Cmd+Backspace 直接删"的快捷绑定。
- [~] 6.3.3 删除后 toast 提供 "Undo（30s）"：实际把记录暂存到 `_pending_delete` 桌面回收。——已实现 Undo toast（`restoreLastDeletedRecord`），但 `_pending_delete` 桌面回收未实现，仅靠内存暂存。

### 6.4 导出菜单升级

- [ ] 6.4.1 三个动作合一为 "Export ▼"：
  - Save a copy as…（现有 copy）
  - Reveal in Finder（现有）
  - Copy as data URL（agent 友好）
  - Copy file path（CLI 友好）

**Phase 6 验收：** Loop 按钮切换循环播放；AB-Loop 区间选择后自动循环；拖出音频到 Finder 成功；删除后 Undo toast 30s 内可恢复。

---

## 7. Phase 7 — 设置页重构（T+5 ~ T+6 周，依赖 P3.3）

- [ ] 7.1 sticky "Unsaved changes · Save / Discard" 顶栏。
- [ ] 7.2 Danger Zone：红色边框 + Trash 图标 + 收缩到折叠组。
- [ ] 7.3 modelDirectory 改动后弹 inline 提示 + "Restart backend now" 按钮（调用 `restart_backend` 命令）。
- [ ] 7.4 增加 "Reset to defaults" 子项（每节卡片右上角）。
- [ ] 7.5 增加 "Reveal config file" 链接（指向 `openloop.sqlite3` 的目录）。

**Phase 7 验收：** 截图回归：Settings 页各 section 与基线差异 < 0.1%；Unsaved changes 指示器在修改后可见；Danger Zone 红色边框 + 折叠组呈现正确。

---

## 8. Phase 8 — 首次设置体验（T+4 ~ T+6 周）

- [~] 8.1 Model 步骤中显式：——部分实现
  - [~] 当前网速 / 估算 ETA——下载进度条有 bytes/sec，但无 ETA 文本估算。
  - [x] 共享 pack 提示（Lite + Turbo 共用 Standard pack）——已实现于 SetupScreen。
  - [x] 镜像选择器（来自 P1.3）——已实现于 SetupScreen。
- [x] 8.2 Welcome 步骤改为 "What is OpenLoop"：3 张小卡（Local-first / Open-source / CLI + GUI），不再仅纯文本。——已实现于 SetupScreen（commit `705f13f`）。
- [ ] 8.3 加 "Skip and try a demo prompt" 路径：跳过模型下载，进入"演示模式"——使用 bundled 30 秒示例音频，让用户先看到界面再决定要不要下模型。
- [ ] 8.4 Done 步骤显示 "Press Cmd+Enter to generate"。

**Phase 8 验收：** 首次启动流程可完整走通且显示 ETA；"Skip and try a demo prompt" 路径跳过下载后能播放 bundled 示例音频。

> **受益于：** P1.3（镜像源）完成后，8.1 的镜像选择器可直接复用。

---

## 9. Phase 9 — 错误与反馈链路（T+5 ~ T+7 周）

### 9.1 Diagnostics bundle

- [ ] 9.1.1 新建 Rust 命令 `commands::support::collect_diagnostics`，输出 JSON：
  - app version、OS、CPU、内存、是否 Apple Silicon、Tauri/MLX/uv 版本
  - 最近 N 条 backend events、最后一次错误 code+message+details
  - **不包含** prompt、lyrics、文件路径以外的内容（与 README 隐私段一致）
- [ ] 9.1.2 Settings → Help & support：
  - "Copy diagnostics（safe to share）"
  - "Save diagnostics file…"
  - "Open issue on GitHub"（用 `https://github.com/.../issues/new?body=` 预填 diagnostics）

### 9.2 错误 UI 升级

- [ ] 9.2.1 `OpenLoopStage` 中错误 banner 改为 expandable card：标题（友好文案）+ "Show details" 折叠 + 三个按钮（Retry / Copy details / Get help）。
- [ ] 9.2.2 错误 code → FAQ 链接的映射放到 `src/app/lib/error-help.ts`。

### 9.3 In-app changelog

- [ ] 9.3.1 Updater 升级成功后弹一次 "What's new"，内容从 `latest.json.notes` 渲染 markdown。
- [ ] 9.3.2 Settings → About 增加 "Release notes" 链接。

**Phase 9 验收：** "Copy diagnostics" 按钮输出 JSON 不包含 prompt/lyrics；GitHub issue 链接可打开且预填 diagnostics；错误 banner 可展开详情且 Retry 按钮可用。

> **依赖：** P9.1 的 diagnostics 会受益于 P11.1 的 tracing 结构化日志，建议 P11.1 先行或并行。

---

## 10. Phase 10 — 可访问性 / 国际化（T+5 ~ T+8 周）

### 10.1 颜色对比

- [ ] 10.1.1 `--color-text-dimmer` 由 `#48484a` 改为 `#7a7a82`（在 `#121212` 上对比度 ≥ 4.5）。
- [ ] 10.1.2 所有依赖 `text-dimmer` 的占位、placeholder 重新审视。
- [ ] 10.1.3 Settings 增加 "High contrast mode" toggle（写入 `data-contrast="high"`，CSS 覆盖）。

### 10.2 ARIA / 键盘

- [ ] 10.2.1 所有 `<input>` 配 `aria-describedby` 指向旁边描述。
- [ ] 10.2.2 折叠 `Collapsible` 用 `aria-expanded` + `role="button"`。
- [ ] 10.2.3 PlaybackBar 进度条用 `<input type="range" aria-label="Seek">`。
- [ ] 10.2.4 全局快捷键面板：按 `Cmd+/` 弹出，列出 `APP_SHORTCUTS`。

### 10.3 i18n 覆盖审计

- [ ] 10.3.1 写脚本 `scripts/i18n-audit.mjs`：比对 `en.json` / `zh-CN.json` 的 key 差集，CI 卡死。
- [ ] 10.3.2 移除 `SettingsOverlay.tsx` 中所有硬编码 `defaultValue` 兜底字符串。
- [ ] 10.3.3 评估增加 `ja-JP`、`ko-KR`（占位准备，不必首版翻译完）。

**Phase 10 验收：** `--color-text-dimmer` 对比度 ≥ 4.5；全局快捷键面板 `Cmd+/` 可打开；`scripts/i18n-audit.mjs` CI 步骤绿通。

---

## 11. Phase 11 — 可观测性（T+6 ~ T+8 周）

### 11.1 结构化日志

- [ ] 11.1.1 引入 `tracing` + `tracing-subscriber`，输出 JSONL 到 `logDirectory/openloop-YYYYMMDD.log`。
- [ ] 11.1.2 替换 `eprintln!` / `println!`（约 30 处）。
- [ ] 11.1.3 文件大小轮转，沿用现有 `BACKEND_LOG_RETAIN_COUNT = 20`。

### 11.2 NDJSON 事件契约正式化

> CLI 侧的 v1 schema（`cli::events` 模块）已在 vnext 中实现。本任务是将其正式化为跨 GUI/CLI 的共享契约。

- [ ] 11.2.1 基于现有 `cli::events` v1 schema，写 `docs/specs/event-schema.md` + JSON schema 文件，覆盖 `lifecycle` / `progress` / `error` 三类事件。
- [ ] 11.2.2 CLI 与 GUI 共用同一 emitter（`services::events`）。

### 11.3 in-app 日志查看器

- [ ] 11.3.1 Settings → Help & support 加 "View logs"，弹出抽屉显示最近 200 行（流式 tail）。
- [ ] 11.3.2 行级过滤（level、event_type）。

**Phase 11 验收：** 所有 `eprintln!` / `println!` 替换为 tracing；日志文件轮转符合 `BACKEND_LOG_RETAIN_COUNT`；in-app 日志查看器可显示最近 200 行并按 level 过滤。

> **注：** CLI 侧的 NDJSON 事件契约（`cli::events` 模块、v1 schema、lifecycle/progress/error 三类事件）已在 `cli-backend-vnext.md` 中实现完毕，本 Phase 只需在其之上扩展 GUI 侧的结构化日志与 in-app 查看器。
> 
> **状态：** `cli::events` v1 schema 和 `BackendManager::ownership()` 等已在 `19875d3` commit 实现。

---

## 12. Phase 12 — 测试矩阵（T+6 ~ T+9 周）

### 12.1 核心链路测试 (Smoke Test & Integration)

- [ ] 12.1.1 建立 Rust 核心服务的集成测试 (Integration Tests)，覆盖模型下载、状态机流转等核心后端链路，先于复杂 UI 测试保障基座稳定。
- [ ] 12.1.2 引入 `tauri-driver` + Playwright 实施轻量级冒烟测试 (Smoke Test)，聚焦 3 条最核心 Happy Path，避免过度复杂的 UI 自动化阻碍进度：
  1. 首次启动 → 设置 → 选 Lite 模型（mock 下载）→ 完成
  2. 已设置 → 写 prompt → 提交 → 看见结果（mock backend）
  3. 历史项点击 → 加载到 form → 恢复呈现

### 12.2 性能基准

- [ ] 12.2.1 `scripts/bench.mjs`：固定 5 条 prompt × 3 次生成，记录耗时 / 内存峰值。
- [ ] 12.2.2 输出 markdown 表，纳入 release notes。

### 12.3 数据库迁移测试

- [ ] 12.3.1 测试用例：从 schema v1 升级到当前最新，断言列存在、数据不丢。
- [ ] 12.3.2 引入 `refinery` 或自建小框架，记录 schema_version 表。

### 12.4 视觉回归

- [ ] 12.4.1 引入 Playwright 截图比对，覆盖关键页面：SetupScreen、AppLayout（空 history）、AppLayout（有 history）、SettingsOverlay 每个 section、Error banner。
- [ ] 12.4.2 像素差阈值 0.1%；diff > 阈值时 CI 失败 + 上传截图 artifact。

**Phase 12 验收：** Playwright 冰烟测试 3 条 Happy Path 通过；视觉回归差异 < 0.1% CI 卡检；迁移测试从 schema v1 升级后数据完整。

> **依赖：** P12.4 （视觉回归）应在 P3/P4/P7 的 UI 大改完成后建基线截图，否则基线无意义。

> **迁移框架前置：** P12.3 提到引入 `refinery` 或自建迁移框架。建议在 P3 或更早阶段引入，因为 P5.1（`003_add_favorite.sql`）和 P14.1（`projects` 表）都会引入新的 schema 变更，统一迁移策略应先于业务表变更。

---

## 13. Phase 13 — 跨平台预研（T+8 ~ T+12 周）

> 这是**预研**而非交付——产出 ADR 和路线图，不一定在 v1 内实现。

- [ ] 13.1 Windows：评估 MLX 缺失 → ACE-Step 的 PyTorch CPU/CUDA 路径可行性；估算包体积与首跑体验。
- [ ] 13.2 Linux：评估 Tauri AppImage / Flatpak 路径。
- [ ] 13.3 Intel Mac：评估 ACE-Step on CPU 性能现实性；可能直接标 "deprecated"。
- [ ] 13.4 产出 `docs/adr/0005-platform-roadmap.md`。

**Phase 13 验收：** 产出 `docs/adr/0005-platform-roadmap.md`，包含各平台可行性结论与建议动作。

---

## 14a. Phase 14a — Project 概念（核心交付，T+8 ~ T+10 周）

### 14a.1 Project / Set 数据模型

- [ ] 14a.1.1 引入 "Project / Set"：一个 project 聚合多个 generations。
- [ ] 14a.1.2 DB schema：设计为纯本地 SQLite 优先方案（`projects(id, name, created_at)`、`generations.project_id`），确保 API 与存储层清晰，以便未来接云端时无需重写业务逻辑。
- [ ] 14a.1.3 侧栏新增"Projects"折叠组，置于"History"上方。
- [ ] 14a.1.4 CONTEXT.md 加 Project 术语章节。

**Phase 14a 验收：** Project 创建/重命名/删除可用；将 Generation 分配到 Project 后侧栏正确分组显示；CONTEXT.md 术语更新。

> **依赖：** P14a 的 DB schema 变更应与 P5.1（收藏）的 schema 变更协调，避免迁移冲突。

---

## 14b. Phase 14b — 产品探索（可选，T+10 ~ T+14 周）

> 以下子项优先级有显著差异，并非全部必须在 v1 交付，建议根据实际进度和战略优先级挑选。

### 14b.1 Repaint 完整版

- [ ] 14b.1.1 Waveform 上支持区间选择（drag），触发 repaint 流。
- [ ] 14b.1.2 与 ACE-Step `/edit` 端点对齐。
- [ ] 14b.1.3 文档化"原音频 + 区间 + 新 prompt → 局部替换"工作流。

### 14b.2 Stem 分离 + MIDI（与 OpenKara 联动）

- [ ] 14b.2.1 评估复用 OpenKara 的 stem 分离链路（如果都用 Spleeter / Demucs）。
- [ ] 14b.2.2 简单 MIDI 导出（基于节拍 + 调性元数据，先不做转录）。

### 14b.3 模型市场雏形

- [ ] 14b.3.1 抽象 `ModelProvider` trait，让 ACE-Step 只是一个实现。
- [ ] 14b.3.2 设计远程 manifest（`https://openloop.openmusic/registry/index.json`），列出可选模型。
- [ ] 14b.3.3 v1 先只走 OpenLoop 官方 registry，未来再开放第三方。

**Phase 14b 验收：** 各子项产出可运行的 prototype 或可行性 ADR。

---

## 15. Phase 15 — 合规与运营（T+8 ~ T+12 周）

- [ ] 15.1 撰写 `LEGAL/PRIVACY.md`（中英）、`LEGAL/TERMS.md`、`LEGAL/EULA.md`。
- [ ] 15.2 About 页列出所有第三方组件 license（ACE-Step Apache 2.0、MLX MIT、Tauri MIT/Apache、FFmpeg LGPL 注意事项、Symphonia 等）。
- [ ] 15.3 在 README 增加 `RESPONSIBLE_USE.md`，扩展现有"Responsible Use"段落。
- [ ] 15.4 评估是否申请 App Store 上架（需要 sandbox + 不能 require external download → 需要做"在线模型不下载到本地"模式或不在 App Store 发）。
- [ ] 15.5 准备 support 渠道：GitHub Discussions 开启、Discord 频道、`SECURITY.md`。

**Phase 15 验收：** `LEGAL/` 目录下存在 PRIVACY.md、TERMS.md、EULA.md；About 页列出所有第三方 license；`SECURITY.md` 存在且 GitHub Discussions 已开启。

---

## 16. Phase 16 — 商业化战略执行与文档化（T+10 ~ T+14 周）

**产出物：** 撰写并敲定 `docs/strategy/PROJECT_STRATEGY.md`，输出明确的战略架构。

**任务清单：**

- [ ] 16.1 确立核心变现与运营路径：界定清楚 OSS Core 与 Pro/云端扩展包 的能力边界。
- [ ] 16.2 制定架构适配方案：梳理 BackendManager 与 settings 的重构范式，划定"本地优先"与"云端能力"的隔离层，确认对现有 SQLite 持久层的影响。
- [ ] 16.3 敲定品牌渠道资产：注册域名、部署 Landing Page、上线文档站点。
- [ ] 16.4 制定版本演进节奏：明确双月迭代（v0.x）与半年里程碑（v1.0）的具体时间表与发版机制。

**Phase 16 验收：** `docs/strategy/PROJECT_STRATEGY.md` 存在且包含明确的变现路径、架构适配方案、版本演进节奏。

---

## 17. 总时间线（甘特视图）

```
Week:        1   2   3   4   5   6   7   8   9   10  11  12  13  14
P1  发布阻塞  ###
P2  安全       ###
P3  代码拆分   #######
P4  主表单         ######
P5  历史/对比          ########
P6  播放器导出         ########
P7  设置页              ######
P8  首次设置             ######
P9  错误反馈              ######            ← 受益于 P11.1 先行
P10 a11y/i18n             #########
P11 可观测性               #######
P12 测试矩阵                #########       ← P12.4 依赖 P3/P4/P7 UI 完成
P13 跨平台预研                     #######
P14a Project概念                      #####
P14b 产品探索（可选）                    ###########
P15 合规运营                        ##########
P16 商业化决策                              #######
```

关键路径：P1 → P3 → P4 → P12.4（视觉回归基线）。

---

## 18. 立即可启动的"第一周 Day-1 计划"

| Day | 任务 |
|-----|------|
| D1 上午 | 明确 entitlements 策略并测试打包（P1.1） + 修 README badge（P1.5）+ 改 CSP（P1.2） |
| D1 下午 | 跑 `pnpm release:check`，把 CSP 改动后的所有 console error 修完 |
| D2 | 新建 `models.manifest.json` 草稿、为 Standard pack 计算 SHA256（P1.3.1–1.3.2） |
| D3 | 实现镜像 fallback（P1.3.3–1.3.6） |
| D4 | Tauri updater 接入（P1.4） |
| D5 | 完善 Gatekeeper 文档（P1.1）；同时启动 P3.1 store 拆分 |

---

## 19. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 缺乏公证导致用户流失 | 中 | 阻塞开源采纳 | 在显著位置提供清晰的 Gatekeeper 绕过图文教程 |
| MLX 在 entitlements 限制下加载失败 | 中 | 严重 | 必须在打包后进行充分测试，确保不闪退 |
| HF 镜像 manifest 不一致 | 高 | 中 | `models.manifest.json` 只信任官方源做主，镜像只做 mirror，SHA256 卡校验 |
| Tauri / MLX / ACE-Step 上游变更 | 中 | 中 | Cargo.lock + pnpm-lock 锁死；Dependabot 灰度 |
| 单人推进时间漂移 | 高 | 中 | 每个 Phase 设独立 PR，避免互相阻塞 |
| 商业化方向反复 | 中 | 高 | P16 不阻塞前面工程；P1–P12 在任意商业化方向上都不会浪费 |

---

## 20. 落地建议

- 每个 Phase 用一个 GitHub Milestone 跟踪；每个 task 一个 issue。
- 推荐用 `/gsd-plan-phase P<n>` 把本文件第 N 章扔给 GSD planner 自动生成 `PLAN.md`。
- 每次进入新 Phase 前重新审视上一 Phase 的 review feedback，避免"计划僵化"。

---

## 21. 与现有计划的整合

- **`docs/plans/2026-05-13-cli-backend-vnext.md`**：~~其 M0–M5 的事件契约 / 后端归属 / 跨进程取消~~。**已实施完毕：** `cli::events` v1 schema、`BackendManager::ownership()`（Owned/Attached/Stopped）、`cancel_requested_at` DB 标志位、`BackendManager::detach()` CLI 用射声明、`exit_code()` 分流、全套 CLI 子命令树（backend/models/generation/files/settings/doctor/status/ps）。P11 只需在其之上扩展 GUI 侧结构化日志与 in-app 查看器。
- **`docs/plans/2026-04-28-acestep-feature-benefits.md`**：作为 P14b（产品探索）输入。
- **`docs/plans/2026-04-28-ui-review.md`**：作为 P4 / P5 / P6 / P7 的设计依据，需要在 P4 启动时回读一遍。
- **`docs/specs/2026-05-04-openloop-cli-design.md`**：CLI 部分已随 vnext 实施更新，继续作为 P11 + P9 的契约参考。

---

**End of Master Plan.**
本文件可作为后续所有 GSD phase plan 的源 prompt；建议每两周 review 一次并把已完成项标注 `~~strike~~` 或迁移到 `archive/`。
