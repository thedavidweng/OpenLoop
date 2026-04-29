# OpenLoop Feature Backlog

**定位**: 纯 AI 音乐生成工具。不做社交、不做平台、不做播放器。把和生成相关的每一件事做到极致。

---

## P0 -- v0.1（修复成本极低，用户价值极高）

### Task 1: 修复 Reuse Prompt 完整参数恢复

**问题**: `store.ts` 的 `loadGenerationSettings` 只恢复了 12 个基础字段，遗漏了 15+ 个高级参数。用户点击 "Use Settings" 后，thinking、inferenceSteps、guidanceScale、referenceAudioPath 等参数丢失。

**要恢复的缺失字段**:
`thinking`, `inferenceSteps`, `guidanceScale`, `useFormat`, `useCotCaption`, `useCotLanguage`, `referenceAudioPath`, `srcAudioPath`, `instruction`, `model`, `lmModelPath`, `lmBackend`, `taskType`, `repaintingStart`, `repaintingEnd`, `audioCoverStrength`, `constrainedDecoding`

**做法**:
1. 打开 `src/app/lib/store.ts`，找到 `loadGenerationSettings` 方法
2. 从 `generations` 表的 `generation_info` JSON 字段中解析完整参数
3. 逐一映射到 store 的所有生成参数状态，包括上述缺失字段
4. 确保 store 中对应的 state 字段都有定义（如没有则补充）

**涉及文件**: `src/app/lib/store.ts`, `src/app/lib/types.ts`
**验证**: 在历史记录中选一个使用了高级参数（如 thinking=true）的生成记录，点击 "Use Settings"，确认所有参数正确回填到生成面板。

---

### Task 2: 歌词结构标签一键插入

**问题**: 用户必须手动输入 `[Verse]`、`[Chorus]` 等标签，格式错误会导致生成质量下降。

**做法**:
1. 在歌词 textarea 上方添加一排可点击标签芯片: `[Verse]` `[Pre-Chorus]` `[Chorus]` `[Bridge]` `[Outro]` `[Instrumental]`
2. 点击后在 textarea 光标位置插入标签 + 换行
3. 样式参考 GenerationPanel 已有的 UI 风格

**涉及文件**: `src/app/components/generation/LyricsEditor.tsx`（或歌词输入所在组件）
**代码量**: 约 20-30 行
**验证**: 在歌词框中输入文字，点击各标签按钮，确认标签正确插入到光标位置。

---

### Task 3: 播放器音量控制

**问题**: PlaybackBar 没有音量控制。用户无法独立于系统音量调节 OpenLoop。

**做法**:
1. 在 PlaybackBar 添加音量图标按钮（mute/unmute）
2. 点击或 hover 展开音量滑块
3. 直接操作 `<audio>` 元素的 `volume` 属性
4. 将音量偏好持久化到 store 或 localStorage

**涉及文件**: `src/app/components/player/PlaybackBar.tsx`（或播放器组件）
**代码量**: 约 30-40 行
**验证**: 播放音频时拖动音量滑块，确认音量变化。关闭重开 app，确认音量偏好保留。

---

### Task 4: 播放器播放速度控制

**问题**: 没有播放速度控制。创作者无法慢放审查人声细节或快放浏览长音频。

**做法**:
1. 在 PlaybackBar 添加速度切换按钮，循环: 0.5x / 0.75x / 1x / 1.25x / 1.5x / 2x
2. 直接操作 `<audio>` 元素的 `playbackRate` 属性
3. 默认 1x，当前速度在按钮上显示

**涉及文件**: `src/app/components/player/PlaybackBar.tsx`
**代码量**: 约 20-30 行
**验证**: 播放音频时切换速度，确认实际播放速度变化。回到 1x 确认恢复正常。

---

### Task 5: 生成失败 Retry 按钮

**问题**: 生成失败后没有一键重试。用户必须重新点击 Generate 按钮。

**做法**:
1. 在生成失败的错误区域（右侧状态卡片）添加 "Retry" 按钮
2. Retry 使用与上次完全相同的参数重新提交
3. 按钮文案: "Retry with same settings"
4. 如果错误是可恢复的（如后端超时），显示 Retry；如果是参数错误（如 prompt 为空），不显示 Retry，改为提示用户修改参数

**涉及文件**: 生成状态显示组件、错误处理组件
**代码量**: 约 30-40 行
**验证**: 手动触发一次生成失败（如停止后端），确认 Retry 按钮出现且点击后能重新提交。

---

## P1 -- v0.2（中等成本，显著提升）

### Task 6: AI Enhance -- LLM 智能扩展风格描述

**问题**: 用户必须手动写出完整精细的风格 prompt。大多数用户不知道如何写有效的风格描述。

**做法**:
1. 在 prompt textarea 下方/旁边添加 "Enhance" 按钮（图标: sparkles/magic wand）
2. 点击后调用后端的 `/format_input` 接口（format 模式），将简单描述扩展为丰富 caption
3. 扩展结果同时可能推导出 BPM、调号、时长等元数据
4. 显示扩展前后的 diff，用户确认后替换
5. 完全在本地 LLM 上运行，不违反隐私约束

**涉及文件**: `src/app/components/generation/` 组件, `src-tauri/src/services/ace_client.rs`（添加 format_input 调用）, 可能需要新增 Tauri command
**前置条件**: 确认后端的 `/format_input` 接口可用且返回格式稳定
**验证**: 输入 "upbeat pop"，点击 Enhance，确认返回更丰富的描述且自动填入。

---

### Task 7: 参考音频文件选择器

**问题**: `referenceAudioPath` 和 `srcAudioPath` 是纯文本输入框，要求用户手动输入绝对路径。对 Cover/Repaint 功能极度不友好。

**做法**:
1. 用 Tauri 的 `@tauri-apps/plugin-dialog` 的 `open` 方法替换文本输入
2. UI: 一个 "Choose File" 按钮 + 选中文件的路径显示 + 清除按钮
3. 文件选择器限定音频格式: mp3, wav, flac, m4a, ogg
4. 支持拖放（drag-and-drop）音频文件到该区域
5. Tauri 运行在本地，不需要上传步骤，直接传本地路径

**涉及文件**: GenerationPanel 高级参数区域, `src-tauri/capabilities/default.json`（确保 dialog 权限）
**前置条件**: 确认 `@tauri-apps/plugin-dialog` 已安装并在 Tauri capabilities 中授权
**验证**: 点击 Choose File，选择一个 mp3 文件，确认路径正确填入。拖放一个 wav 文件，确认同样有效。

---

### Task 8: Instrumental Toggle -- 独立无伴奏开关

**问题**: 没有独立的 Instrumental 开关。BGM 用户需要通过其他方式间接控制。

**做法**:
1. 在 `vocalLanguage` 选择器旁边添加 "Instrumental" toggle
2. 开启时: 隐藏/禁用 vocalLanguage 选择器，设置空歌词或跳过 LM 推理
3. 关闭时: 恢复 vocalLanguage 选择器
4. 确认后端对无伴奏生成的参数要求（可能需要设置特定字段）

**涉及文件**: GenerationPanel 参数区域, store
**代码量**: 约 40-50 行
**验证**: 开启 Instrumental，确认 vocalLanguage 被隐藏。生成一段纯器乐音频，确认没有人声。

---

### Task 9: 批量变体生成

**问题**: 同一参数只能生成一个结果。AI 音乐生成不确定性高，用户需要比较多个候选。

**做法（两阶段）**:

**阶段 A -- 队列变体（低成本）**:
1. 在 GenerationPanel 添加 "Variations" 数量选择器（1-4，默认 1）
2. 提交时为每个变体设置不同的随机 seed
3. 利用现有的单任务机制顺序执行：前一个完成后自动开始下一个
4. 在 UI 中显示队列进度（如 "Variation 2/4"）

**阶段 B -- Batch 生成（中成本，视后端 API 支持）**:
1. 如果 `/release_task` 支持 batch 参数，直接传 batch_size
2. 一次性提交，批量返回

**涉及文件**: GenerationPanel, store 生成状态管理, Rust generation service
**阶段 A 代码量**: 约 80-100 行
**验证**: 设置 Variations=3，提交生成，确认生成 3 个不同 seed 的音频，队列依次执行。

---

## P2 -- 后续版本

### Task 10: 随机描述灵感种子

**做法**: 在 prompt textarea 旁边添加骰子图标按钮。点击后从本地 JSON 文件随机选取一个示例描述填入 prompt。不需要联网。

**涉及文件**: GenerationPanel, 新增 `src/app/data/prompt_examples.json`
**代码量**: 约 30-40 行

---

### Task 11: 生成任务恢复

**做法**: 将活跃任务的 task_id 和参数持久化到数据库。应用启动时检查是否有未完成任务（如上次被强制关闭），提示用户恢复或放弃。

**涉及文件**: Rust db service, generation service, 前端启动流程
**代码量**: 约 100-150 行

---

### Task 12: 波形可视化（Repaint 区间选择用）

**做法**: 在播放器中渲染音频波形。短期用静态波形图（生成后一次性渲染）。长期在 Repaint 功能中实现交互式区间选择（拖动选取起止时间）。

**建议**: 调查 OpenKara 是否有现成的波形渲染组件可复用。
**涉及文件**: PlaybackBar 或新的 WaveformView 组件, WaveSurfer.js 或 Canvas API
**代码量**: 200+ 行

---

### Task 13: 快捷键完善

**做法**: 确保 `app-shortcuts.ts` 覆盖以下快捷键:
- `Space`: 播放/暂停（焦点不在输入框时）
- `Cmd+Enter`: 提交生成
- `Cmd+Shift+R`: 重试上次生成
- `Cmd+N`: 重置表单

**涉及文件**: `src/app/lib/app-shortcuts.ts`
**代码量**: 约 30-40 行
