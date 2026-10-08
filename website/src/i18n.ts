export type Language = "en" | "zh-CN";

// English lives in index.html so the page is complete without JavaScript.
// Chinese overrides it key by key; English is captured from the DOM on boot.
const ZH: Record<string, string> = {
  skip: "跳到正文",
  "nav.workflow": "工作流",
  "nav.local": "隐私",
  "nav.cli": "命令行",
  "nav.models": "模型",
  "nav.faq": "常见问题",
  "nav.download": "下载",
  "hero.badge": "v0.2.1 Alpha · 现已成为原生 macOS 应用",
  "hero.title": "在你的 Mac 上做音乐，而不是在云端。",
  "hero.body":
    "OpenLoop 用在 Apple 芯片上本地运行的开源模型，把一句描述和一段歌词变成完整的曲子。快速打草稿、对比不同 Take，每个文件都留在你手里。无需账号，不用上传，没有额度。",
  "hero.primary": "下载 Mac 版",
  "hero.secondary": "在 GitHub 查看",
  "hero.meta": "免费开源 · macOS 15+ · Apple 芯片",
  "stage.caption":
    "可交互预览。改一改提示词、生成 Take、A/B 对比，或在波形上拖选一段来重绘。这里的声音由浏览器实时合成，用来演示工作流，并非模型输出。",
  foundations: "构建于开源基石之上",
  "workflow.eyebrow": "01 · 工作流",
  "workflow.title": "从一句话，到一首留得住的歌。",
  "workflow.body":
    "每个想法都放在一个 Project 里。每次生成都是一个 Take，可以播放、对比、复现和打磨。它是一本速写本，而不是老虎机。",
  "workflow.c1.title": "描述它",
  "workflow.c1.body": "写下氛围，加上歌词，设定速度、调性和拍号。每个 Take 最长十分钟。",
  "workflow.c2.title": "对比 Take",
  "workflow.c2.body": "一次生成多个 Take，在同一播放位置随时切换 A 和 B。",
  "workflow.c3.title": "复现或分支",
  "workflow.c3.body": "每个 Take 都记录了种子和参数。可以原样复现，也可以分支出相近的变体。",
  "workflow.c4.title": "局部重绘",
  "workflow.c4.body": "在波形上拖选一段，只重新生成这一部分。循环试听，直到满意为止。",
  "local.eyebrow": "02 · 隐私优先",
  "local.title": "你的录音室，从不离开你的 Mac。",
  "local.body":
    "模型只需下载一次，之后每次生成都在 Apple 芯片上完成。提示词、歌词和音频都保存在你自己的曲库里，在访达里就能打开。",
  "local.m1": "条提示词被发送到服务器",
  "local.m2": "没有订阅，也没有额度",
  "local.m3.value": "10 分钟",
  "local.m3": "每个 Take 的最长时长",
  "local.c1.title": "端侧推理",
  "local.c1.body": "内置运行时通过 MLX 和 Metal 运行 ACE-Step。安装时不需要 Python，也不需要终端。",
  "local.c2.title": "属于你的曲库",
  "local.c2.body": "Project、可搜索的历史记录和收藏。音频、时间轴歌词和元数据都能导出为普通文件。",
  "local.c3.title": "开源",
  "local.c3.body": "应用采用 AGPL-3.0 许可。可以阅读代码、自行构建，按需修改。",
  "cli.eyebrow": "03 · 给脚本和智能体",
  "cli.title": "同一个录音室，无界面运行。",
  "cli.body":
    "应用内附带一个独立的命令行工具，与图形界面共享同一个曲库。脚本生成的 Take 会立刻出现在历史记录里，反之亦然。",
  "cli.l1": "以 NDJSON v2 流式输出进度、结果和错误",
  "cli.l2": "首次使用时自动安装运行时和模型",
  "cli.l3": "Ctrl-C 干净取消，已完成的 Take 会保留",
  "cli.link": "阅读命令行指南",
  "models.eyebrow": "04 · 模型",
  "models.title": "一个应用，引擎随心换。",
  "models.body":
    "第一方目录列出每个引擎和模型包的体积、内存需求与许可。安装适合你 Mac 的那一个，切换时无需改配置文件。",
  "models.h.pack": "模型包",
  "models.h.configs": "配置",
  "models.h.size": "下载体积",
  "models.h.license": "许可",
  "models.h.status": "状态",
  "models.available": "可用",
  "models.announced": "已预告",
  "models.unverified": "尚未核实",
  "models.note":
    "需要 Apple 芯片和 macOS 15 或更高版本。建议 24 GB 统一内存。内存更小的 Mac 可以运行 Lite，但可能会大量使用交换空间。",
  "faq.eyebrow": "05 · 常见问题",
  "faq.title": "好问题。",
  "faq.body": "还有疑问？到 GitHub 提一个 issue。路线图和已知限制都是公开的。",
  "faq.q1": "OpenLoop 真的免费吗？",
  "faq.a1": "是的。应用以 AGPL-3.0 开源，没有账号、订阅或生成额度。所有计算都由你的 Mac 完成。",
  "faq.q2": "需要联网吗？",
  "faq.a2": "只有首次设置时需要，用来下载运行时和你选择的模型包。之后的生成完全离线进行。",
  "faq.q3": "支持哪些 Mac？",
  "faq.a3":
    "搭载 Apple 芯片、运行 macOS 15 或更高版本的 Mac。建议 24 GB 统一内存，目前的后端即使使用 Lite 也可能超过 16 GB。",
  "faq.q4": "生成的音乐可以发布吗？",
  "faq.a4":
    "每个模型都有自己的许可，应用会在安装前展示。生成内容不保证没有版权争议，发布前请查看模型和内容条款。",
  "faq.q5": "为什么打开时 macOS 会发出警告？",
  "faq.a5": "Alpha 版本使用临时签名，尚未经过公证。发布说明里介绍了首次安全打开的方法。",
  "closing.title": "你的下一首歌，从一句话开始。",
  "closing.star": "在 GitHub 点星",
  "footer.tagline": "为 Apple 芯片打造的本地音乐生成工具。OpenMusic 系列的一员。",
  "footer.product": "产品",
  "footer.download": "下载",
  "footer.cli": "命令行指南",
  "footer.changelog": "更新日志",
  "footer.project": "项目",
  "footer.source": "源代码",
  "footer.issues": "问题反馈",
  "footer.license": "AGPL-3.0 许可",
  "footer.series": "OpenMusic",
  "footer.openkara": "OpenKara · 卡拉 OK",
  "footer.disclaimer": "第三方运行时和模型保留各自的许可条款。",
};

const UI = {
  en: {
    switchLanguage: "切换到中文",
    languageLabel: "中文",
    themeToLight: "Switch to light theme",
    themeToDark: "Switch to dark theme",
  },
  "zh-CN": {
    switchLanguage: "Switch to English",
    languageLabel: "EN",
    themeToLight: "切换到浅色主题",
    themeToDark: "切换到深色主题",
  },
} as const;

const english = new Map<Element, string>();

export function uiCopy(language: Language) {
  return UI[language];
}

export function applyLanguage(language: Language): void {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    if (!english.has(element)) {
      english.set(element, element.textContent?.replace(/\s+/g, " ").trim() ?? "");
    }
    const key = element.getAttribute("data-i18n") ?? "";
    const text = language === "zh-CN" ? (ZH[key] ?? english.get(element)) : english.get(element);
    if (text !== undefined) {
      element.textContent = text;
    }
  });
  document.documentElement.lang = language;
  document.documentElement.classList.remove("i18n-pending");
}
