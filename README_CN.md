[English](./README.md)

<div align="center">

<img src="./src-tauri/icons/1024x1024.png" alt="OpenLoop 图标" width="160" height="160" />

# OpenLoop

**在 Mac 上本地生成音乐。**

[![CI](https://github.com/thedavidweng/OpenLoop/actions/workflows/ci.yml/badge.svg)](https://github.com/thedavidweng/OpenLoop/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/thedavidweng/OpenLoop?include_prereleases&label=release)](https://github.com/thedavidweng/OpenLoop/releases)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](./LICENSE)

**v0.2.1 Alpha · 原生 macOS · Apple Silicon · macOS 15+**

</div>

## 原生工作区

SwiftUI 应用与独立 Swift CLI 共用 Swift 核心。用项目整理音乐想法，通过提示词和歌词生成 Takes，进行 A/B 对比、复用种子或生成变体，在波形上选择区域循环播放或 Repaint，并导出产物。跨项目历史支持搜索和收藏。设置可在本地安装固定版本的 ACE-Step 运行时和模型包。MiniMax Music 3 尚未开放安装，当前界面仅支持英语。固定后端即使使用 Lite 也可能超过 16 GB 内存，低内存设备会明显换页；安装前请查看实测验收记录。

以下为隔离测试库中的真实原生应用截图。工作区 Takes 使用合成 WAV 测试音频；历史截图展示真实生成的 10 秒 Lite 音频，seed 为 42。截图不代表听感质量验收。详细验证范围见[验收记录](docs/testing.md#native-macos-acceptance--2026-10-07)。

**创作、Takes 和检查器——深色外观**

![Native OpenLoop workspace with two test Takes and A/B comparison](docs/screenshots/native-workspace.jpg)

<details>
<summary>浅色外观、历史、模型目录和首次设置</summary>

![Native OpenLoop workspace in light appearance](docs/screenshots/native-workspace-light.jpg)

![Native History with a real generated Take, seed 42, and audio transport](docs/screenshots/native-history.jpg)

![Native model catalog with download sizes and unavailable models](docs/screenshots/native-models.jpg)

![Native first-time setup with compatibility checks and license review](docs/screenshots/native-setup.jpg)

</details>

## 安装

原生发布流程构建 Apple Silicon DMG 并创建草稿发布。原生版本发布后，从 [Releases](https://github.com/thedavidweng/OpenLoop/releases) 下载对应 DMG，将 OpenLoop 拖入 Applications。旧发布资产和 Homebrew cask 可能仍指向 Tauri 应用，升级前请确认下载的是原生版本。

此 Alpha 使用 ad-hoc 签名，尚未进行 Developer ID 签名或公证。下载副本若被 Gatekeeper 拦截，请参阅[发布指南](docs/release.md)。原生应用没有内置自动更新。

升级前退出旧版并备份资料库。原生核心只导入旧数据一次，不移动原始音频。原生 GUI 与 CLI 共用资料库，但修改不会同步回旧版应用。测试 GUI 可设置 `OPENLOOP_DATA_DIR=/tmp/openloop-native-test`，CLI 使用 `--data-dir /tmp/openloop-native-test` 隔离数据。

## CLI

无界面命令由独立可执行文件提供：

```sh
CLI=/Applications/OpenLoop.app/Contents/MacOS/openloop-cli
"$CLI" catalog --json
"$CLI" setup --accept-license
"$CLI" models install ace-step/standard --accept-license
"$CLI" run --configuration ace-step/lite --prompt 'gentle piano' --duration 10 --json
"$CLI" list --json
```

接受前请阅读目录中的许可条款。首次设置会下载 Python 运行时和依赖，模型包还需下载数 GB；音乐推理在本地运行。原生 `--json` 使用 **NDJSON v2**，旧 v1 脚本需要迁移。[CLI 指南](docs/cli.md) · [v2 协议](docs/specs/native-cli.md)。

## 从源码构建

需要 Apple Silicon、macOS 15+、Swift 6.2+，以及准备 sidecar 所需的 Node.js 24+。

```sh
swift build --package-path native -Xswiftc -warnings-as-errors
swift test --package-path native -Xswiftc -warnings-as-errors
node scripts/prepare-sidecars.mjs
python3 native/scripts/package-app.py --uv src-tauri/binaries/uv-aarch64-apple-darwin
python3 native/scripts/smoke-cli.py
```

[原生架构与开发](native/README.md) · [发布打包](docs/release.md)。React/Tauri/Rust 保留为迁移参考，不再是原生发布目标。

## OpenMusic 系列

[OpenKara](https://github.com/thedavidweng/OpenKara) 使用本地 AI 分离伴奏并同步歌词；OpenLoop 根据创作意图生成音乐。二者都重视本地处理和用户对内容的掌控。

## 贡献

大型变更请先开 issue。路线图见 [GitHub Issues](https://github.com/thedavidweng/OpenLoop/issues)，测试范围见[验收指南](docs/testing.md)。

## 许可证

OpenLoop 应用代码使用 [Apache License 2.0](LICENSE)。第三方运行时、模型和工具遵循各自条款。生成内容不保证无版权限制，发布前请审阅相应条款。

## 致谢

基于 [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5)、[MLX](https://github.com/ml-explore/mlx) 和开源音频工具构建。由 [David Weng](https://github.com/thedavidweng) 发起，属于 OpenMusic 系列。
