# Zotero AI Notes 第五阶段验收记录（2026-07-14）

## 结论

第五阶段“形成完整闭环”已在 macOS 的 Zotero 9.0.6 中完成真实验收，实机加载版本为 `0.2.3`。

已完成并验证以下链路：

```text
识别用户关注重点
→ 生成自然笔记
→ 后台校验
→ 用户预览
→ 写回 Zotero
→ 导出 Markdown
```

本阶段没有加入 Markmap、Mermaid 或其他思维导图功能。

## 实现范围

- 根据真实批注与相邻原文识别关注重点，并允许用户勾选和调整优先级；
- 根据确认后的关注重点生成不带内部 ID 的自然 Markdown 笔记；
- 使用本地规则和 Gemini 进行后台校验，校验通过后才允许写回或导出；
- 在独立窗口中同时提供 Markdown 编辑区和渲染预览；
- 写回时只创建新的 Zotero 子笔记，不覆盖已有笔记；
- 通过系统保存对话框导出 UTF-8 Markdown 文件；
- Zotero 子笔记保留生成时间、模型、模板、上下文模式、证据数量和插件版本等生成信息，但不显示内部 Evidence ID。

## 0.2.3 修复

Gemini 可能把 Zotero 批注 ID 以 JSON 数字返回，例如 `5`，而不是字符串 `"5"`。此前解析器会丢弃这类 ID，导致关注重点被误判为没有真实批注支持。

`0.2.3` 将批注 ID 解析统一为字符串，同时在提示词中明确要求原样复制字符串 ID，并增加了数字 ID 回归测试。

## 自动测试

- TypeScript 类型检查：通过；
- Vitest：9 个测试文件、27 个测试全部通过；
- ESLint：0 个错误；
- XPI 构建和结构验证：通过；
- 安装包：`zotero-ai-notes-0.2.3.xpi`；
- 最终安装包 SHA-256：`99ed8487a5d27feff7d9f8f6fa6a56c29b5eefdda7d74e34ecca3ba23916f240`；
- Zotero 插件管理接口返回：`0.2.3 enabled=true`。

## Zotero 9.0.6 实机验收

测试文献：`ImageNet classification with deep convolutional neural networks`。

实测结果：

- PDF 附件：1 个；
- 真实批注：17 条；
- 成功定位相邻原文：16/17；
- 识别关注重点：3 个；
- 生成和后台校验：通过；
- Markdown 编辑与渲染预览：通过；
- 用户可见正文中的内部 Evidence ID：0 个；
- Zotero 写回：成功，新建子笔记 ID `30`；
- 写回后的父条目笔记数：从 0 增加到 1；
- 已有笔记覆盖：0；
- Markdown 导出：成功，UTF-8 编码；
- 导出文件中的内部 Evidence ID：0 个。

导出文件：

```text
ImageNet_AI整理笔记_0.2.3.md
```

识别出的三个关注重点：

1. 网络架构设计；
2. 模型训练与正则化技术；
3. 数据增强策略。

## 跨平台说明

- 路径使用 Zotero/Gecko 的跨平台路径和文件接口，不拼接 macOS 专用路径；
- Markdown 通过 Zotero 文件选择器保存，在 macOS、Windows 和 Linux 上使用各自的原生保存窗口；
- Zotero 子笔记写回使用 Zotero 数据 API，不依赖 macOS 专用能力；
- API Key 继续使用 Zotero/Firefox Login Manager；
- 已在 macOS Zotero 9.0.6 完成实机验收，Windows Zotero 9 仍需在 Windows 设备上做最终回归。

## 下一阶段边界

第六阶段只在第五阶段保持稳定后增加思维导图：

```text
稳定 Markdown 笔记
→ 转换为 Markmap 或 Mermaid 数据
→ 用户预览
→ 导出或写回
```

第六阶段不应改变已经通过验收的批注读取、Evidence、笔记生成、校验、写回和 Markdown 导出链路。
