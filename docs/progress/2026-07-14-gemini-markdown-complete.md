# Zotero AI Notes 第四阶段验收记录（2026-07-14）

## 结论

第四阶段“接入大模型并返回 Markdown”已在 macOS 的 Zotero 9.0.6 中完成真实验收。

本阶段增加 Gemini 配置、连接测试、Evidence 发送和 Markdown 返回。仍未实现用户关注重点识别、后台校验、预览、写回 Zotero、正式导出或思维导图。

## 配置

- Base URL：`https://generativelanguage.googleapis.com/v1beta/openai/`；
- 模型：`gemini-3.1-flash-lite`；
- API Key：通过 Zotero/Firefox Login Manager 保存到本机凭据库；
- 设置页只显示 Key 是否已保存，不回显 Key；
- 请求和调试日志不记录 Key、Authorization 头或请求正文。

设置页已验证以下交互：

- 默认 Base URL 和模型正常显示；
- 保存、测试连接、清除 Key 按钮可用；
- 未配置 Key 时显示明确错误；
- 配置有效 Key 后显示“连接成功，API Key 和模型可用”。

## 请求范围

插件只向模型发送第三阶段形成的 Evidence 数据，包括文献标题、批注文本、用户评论、标签、页码和必要的附近原文。没有发送整篇 PDF 文件。

模型被要求：

- 返回 Markdown；
- 只依据提供的 Evidence；
- 对事实性内容引用对应 Evidence ID；
- 不执行第五阶段的写回或导出行为。

## 自动测试

- TypeScript 类型检查：通过；
- Vitest：6 个测试文件、16 个测试全部通过；
- 覆盖 Gemini 连接请求、Markdown 请求与响应解析、配置校验、API Key 脱敏及原有数据链路；
- XPI 构建和结构验证：通过；
- 实机安装版本：`0.1.2`；
- 安装包 SHA-256：`76d8f588d659d52db1d5393596aee07b80d09d2ab106ba3583f84c1627d0b49b`。

## Zotero 9.0.6 实机验收

测试文献：`NEURAL MACHINE TRANSLATION BY JOINTLY LEARNING TO ALIGN AND TRANSLATE`。

实测结果：

- PDF 附件：1 个；
- 真实批注：4 条；
- Evidence：4 条；
- Gemini 连接：成功；
- Markdown 返回：成功；
- Markdown 大小：2,118 字节；
- Markdown 引用的 Evidence：4/4；
- 不存在的 Evidence 引用：0；
- 未被引用的 Evidence：0。

生成文件：

```text
zotero-ai-notes-RXKGFINC-generated.md
```

四个 Evidence ID 均在 Markdown 中被引用并与 Evidence JSON 一致：

```text
E-DZ4EE99E-1-01
E-DZ4EE99E-1-02
E-DZ4EE99E-2-01
E-DZ4EE99E-2-02
```

## 跨平台说明

- 网络请求使用 Zotero 提供的跨平台 HTTP 能力；
- API Key 使用 Zotero/Firefox Login Manager，不依赖 macOS Keychain 专用 API；
- 临时 Markdown 继续使用 `PathUtils.tempDir` 和 `PathUtils.join`，没有写死 macOS 路径；
- Windows Zotero 9 的安装、凭据保存和真实请求仍需在 Windows 设备上最终回归。

## 下一阶段边界

第五阶段将形成完整闭环：

```text
识别用户关注重点
→ 生成自然笔记
→ 后台校验
→ 用户预览
→ 写回 Zotero
→ 导出 Markdown
```

第五阶段完成并稳定前，不开始 Markmap 或 Mermaid 思维导图。
