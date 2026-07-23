# Changelog

## 0.3.8 - 2026-07-22

- 将生成窗口改为“确认关注重点 → 生成与审查 → 查看与保存”的分阶段流程，避免同时展示空白编辑区和预览区。
- 移除含义不清且在 Zotero 中显示异常的数字优先级下拉框，改为最多选择两个“重点主题”。
- 重点主题会在规划和笔记生成阶段被优先、更详细地展开，普通选中主题仍会正常覆盖。
- 生成期间锁定主题设置，并保留取消、失败阶段重试、调用次数和阶段耗时反馈。
- 修复写回已经成功但顶部一直显示“正在写回 Zotero”的状态问题，并阻止同一内容被重复写回。
- 新建笔记的标题改为显示本地日期和精确到秒的时间，便于区分同一天的多次生成。
- 笔记大纲改为根据已确认主题和 Evidence 在本地生成，再用本地风险校验决定是否触发模型审查；无明确风险时只调用模型 1 次。
- 强化 Markdown 分节与空行要求，并为异常的超长纯文本增加预览自动分段。
- 修复 XUL 预览窗口将动态 Markdown 标题和段落误建为行内节点，导致预览内容仍然挤在一起的问题。

## 0.3.7 - 2026-07-21

- 修复 Zotero 插件沙箱缺少 `AbortController` 时关注重点识别立即失败的问题。
- 使用插件内置取消信号继续支持真正取消请求，并恢复重新识别功能。
- 修复带千位分隔符和中英文数量单位的等价数字被误判为无依据的问题。

## 0.3.6 - 2026-07-21

- 为生成流水线增加阶段状态、耗时、模型调用次数和失败原因展示。
- 支持真正取消当前模型请求，并保留已完成的大纲或笔记。
- 支持从失败或取消的阶段继续重试，避免重复执行已完成阶段。

## 0.3.5 - 2026-07-15

- 递归兼容 Responses API output 中的 text、output_text、content、value 和 summary 正文键。
- 空正文诊断显示 output 项与 content 项字段名。

## 0.3.4 - 2026-07-15

- Chat Completions 返回空正文时自动回退到同一服务的 Responses API。
- 诊断信息增加 finish_reason，区分格式不兼容与模型未输出正文。

## 0.3.3 - 2026-07-15

- 进一步兼容单对象 content、delta、reasoning、analysis 等网关返回字段。
- 空正文错误会显示安全的嵌套字段名，便于定位兼容服务差异。

## 0.3.2 - 2026-07-15

- 将完整生成请求的超时从 60 秒延长到 180 秒，连接测试仍保持 30 秒。
- 兼容 Chat Completions 内容数组、Responses API output 和部分兼容服务的正文结构。
- 连接测试现在会验证模型确实返回正文，避免“连接成功但无法生成”的误报。
- 生成时显示规划、写作、审查、自动修订和复核的具体阶段。

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
