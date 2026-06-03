# Privacy Policy — OpenLoop

**Effective date:** 2026-05-14

OpenLoop is local-first by design. This document explains what data stays on your device, when the app uses the network, and what third-party components are involved.

## What stays local

- **Prompts** — everything you type into the generation form stays on your Mac.
- **Lyrics** — any text you enter as lyrics stays on your Mac.
- **Generated audio** — output files are written to your chosen output directory.
- **History** — generation records, settings, and backend events are stored in a local SQLite database (`openloop.sqlite3`).
- **Model weights** — downloaded ACE-Step model files are cached locally in your app data directory.

## When the app uses the network

| Scenario                       | Destination                             | Purpose                                               |
| ------------------------------ | --------------------------------------- | ----------------------------------------------------- |
| First model download           | `huggingface.co` (or configured mirror) | Download ACE-Step model weights                       |
| Backend health check           | `127.0.0.1:*` or `localhost:*`          | Talk to the local ACE-Step API server                 |
| Automatic updates (if enabled) | GitHub Releases                         | Check for and download app updates                    |
| User-initiated external links  | Various                                 | Only when you click a link that opens in your browser |

## What we do NOT collect

- No telemetry or analytics.
- No cloud account or login.
- No prompts, lyrics, or generated audio are sent to any external service except the local backend.
- No crash reports are sent automatically.

## Third-party components

| Component    | License          | Purpose                                |
| ------------ | ---------------- | -------------------------------------- |
| ACE-Step 1.5 | Apache 2.0       | Local music generation backend         |
| MLX          | MIT              | Apple Silicon inference                |
| Tauri        | MIT / Apache 2.0 | Desktop framework                      |
| FFmpeg       | LGPL             | Audio decoding (via Symphonia in Rust) |
| Symphonia    | MPL 2.0          | Rust audio decoding for waveforms      |

## Contact

If you have questions about this privacy policy, open an issue on GitHub.

---

# 隐私政策 — OpenLoop

**生效日期：** 2026-05-14

OpenLoop 以本地优先为设计原则。本文档说明哪些数据保留在设备上、应用何时使用网络、以及涉及哪些第三方组件。

## 保留在本地的是什么

- **提示词** — 你在生成表单中输入的所有内容都保留在你的 Mac 上。
- **歌词** — 你输入的任何歌词文本都保留在你的 Mac 上。
- **生成音频** — 输出文件写入你选择的输出目录。
- **历史记录** — 生成记录、设置和后端事件保存在本地 SQLite 数据库中（`openloop.sqlite3`）。
- **模型权重** — 下载的 ACE-Step 模型文件缓存在应用数据目录中。

## 应用何时使用网络

| 场景                   | 目标地址                           | 目的                             |
| ---------------------- | ---------------------------------- | -------------------------------- |
| 首次模型下载           | `huggingface.co`（或配置的镜像源） | 下载 ACE-Step 模型权重           |
| 后端健康检查           | `127.0.0.1:*` 或 `localhost:*`     | 与本地 ACE-Step API 服务器通信   |
| 自动更新（如启用）     | GitHub Releases                    | 检查并下载应用更新               |
| 用户主动打开的外部链接 | 多个                               | 仅当你点击在浏览器中打开的链接时 |

## 我们不收集什么

- 不收集遥测或分析数据。
- 没有云端账号或登录系统。
- 除了本地后端外，不会将提示词、歌词或生成音频发送到任何外部服务。
- 不会自动发送崩溃报告。

## 第三方组件

| 组件         | 许可证           | 用途                               |
| ------------ | ---------------- | ---------------------------------- |
| ACE-Step 1.5 | Apache 2.0       | 本地音乐生成后端                   |
| MLX          | MIT              | Apple Silicon 推理                 |
| Tauri        | MIT / Apache 2.0 | 桌面框架                           |
| FFmpeg       | LGPL             | 音频解码（通过 Rust 的 Symphonia） |
| Symphonia    | MPL 2.0          | Rust 音频解码生成波形              |

## 联系方式

如有关于本隐私政策的问题，请在 GitHub 上提交 issue。
