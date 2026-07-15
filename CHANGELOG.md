# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Project initialization

## [0.3.1] - 2026-07-15

### Added

- 设置页新增 Gemini、OpenAI 兼容、DeepSeek 和自定义提供商预设，保留 Base URL、模型名称和连接测试。
- 关注重点识别失败时显示具体原因，并可在当前窗口重新识别。
- Windows 和小屏窗口提供始终可见的标题栏关闭按钮。

### Fixed

- 隐藏的 Mermaid 渲染框不再挤占预览窗口高度，窗口尺寸会按可用屏幕自动收缩。
- Markdown 预览显式恢复标题、段落和列表布局，并兼容模型返回转义换行的情况。
- 关注重点结构校验失败时自动请求模型修正一次，兼容单值形式的批注 ID。

## [0.3.0] - 2026-07-14

### Added

- 从已经通过后台校验的 Markdown 笔记确定性生成 Mermaid `mindmap` 源码，不再次调用模型或加入新事实。
- 在结果窗口优先显示 Mermaid SVG，并提供树状回退预览、Mermaid 源码查看和复制。
- 支持将 Mermaid 思维导图导出为 UTF-8 Markdown 文件。

### Fixed

- Zotero 内嵌浏览器无法渲染 Mermaid SVG 时，仍允许查看结构和导出有效的 Mermaid 源码。
- 使用 XUL 预览窗口承载独立的标准 XHTML 渲染帧，避开 Mermaid 对 XUL DOM 的不兼容，同时保留 Zotero 9 的窗口加载能力。

### Notes

- XMind 格式不包含在本版本中，留待后续独立升级。

## [0.2.3] - 2026-07-14

### Added

- 第五阶段完整闭环：关注重点识别、自然笔记生成、后台校验、预览编辑、Zotero 子笔记写回和 Markdown 导出。
- 独立预览窗口及 Zotero 9 chrome 资源注册。

### Fixed

- 兼容 Gemini 在结构化 JSON 中返回数字形式的批注 ID，避免真实文献关注重点识别失败。
- 用户可见笔记、预览和导出文件不再显示内部 Evidence ID。
