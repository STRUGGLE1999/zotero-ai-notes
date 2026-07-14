# Zotero AI Notes 第三阶段验收记录（2026-07-14）

## 结论

第三阶段“读取 PDF 上下文并建立 Evidence 数据”已在 macOS 的 Zotero 9.0.6 中完成真实验收。

本阶段只读取存在批注的 PDF 页面，定位高亮附近原文，并生成内部 Evidence JSON。没有调用大模型、生成 Markdown、写回 Zotero 或修改原始批注。

## Zotero 9.0.6 API 核对

本机 Zotero 9.0.6 的 `Zotero.PDFWorker.getFullText()` 底层实现支持传入具体页索引，并返回：

- `text`：提取后的页面文本；
- `extractedPages`：实际提取页数；
- `totalPages`：PDF 总页数。

因此第三阶段不需要引入第三方 PDF 解析库，也不需要读取整篇 PDF。插件只向 Zotero 请求有批注的页面。

## Evidence 数据

每条 Evidence 包含：

- 内部 Evidence ID；
- 附件 Key、批注 ID 和批注 Key；
- 批注类型、原始高亮、用户评论和标签；
- PDF 页码和页签；
- 当前段落及前后各一段原文；
- 原文定位方式；
- 内容哈希；
- 无法定位时的明确警告。

Evidence ID 格式遵循技术设计：

```text
E-{attachmentKey}-{page}-{sequence}
```

## 原文定位策略

1. 对规范化后的高亮文本做精确匹配；
2. 精确匹配失败时按关键词覆盖率做模糊匹配；
3. PDF 将一次连续选择拆成相邻短批注时，根据批注矩形位置复用相邻 Evidence 上下文；
4. 无法可靠定位或页面无可提取文本时，只保留批注本身并添加警告；
5. 单字符英文批注按独立词匹配，避免把 `y` 错配到 `probability` 等单词中；
6. 上下文严格限制为当前段落及前后各一段，最长 2,500 字符。

## 自动测试

- TypeScript 类型检查：通过；
- ESLint：0 个错误，保留 23 个 `any` 类型警告；
- Vitest：4 个测试文件、10 个测试全部通过；
- 覆盖具体批注页提取、精确匹配、相邻批注复用、无文本降级、无批注提示、Evidence JSON 写入和 Windows 临时目录路径；
- XPI 构建和结构验证：通过；
- 实机安装包 SHA-256：`f1489afe9a710635ed53c72fea94f72c69bb8e9be218618cccc3f12165803b5c`。

## Zotero 9.0.6 实机验收

测试文献：`NEURAL MACHINE TRANSLATION BY JOINTLY LEARNING TO ALIGN AND TRANSLATE`。

实测结果：

- PDF 附件：1 个；
- 真实批注：4 条；
- 有批注的页面：2 页；
- Evidence：4 条；
- 成功定位原文：4/4；
- 降级为仅批注：0 条；
- 警告：0 条。

四条 Evidence ID：

```text
E-DZ4EE99E-1-01
E-DZ4EE99E-1-02
E-DZ4EE99E-2-01
E-DZ4EE99E-2-02
```

其中前三条为 `exact`，单字符批注 `y` 与上一条下划线批注在同一行且相邻，因此使用 `adjacent_annotation`，并复用第 2 页正确上下文。

生成文件：

```text
zotero-ai-notes-RXKGFINC-evidence.json
```

## 跨平台说明

- PDF 文本由 Zotero 自带 PDF Worker 提取，不依赖 macOS 工具；
- 运行时代码没有写死用户目录、盘符或路径分隔符；
- Evidence JSON 继续使用 `PathUtils.tempDir`、`PathUtils.join` 和 `Zotero.File.putContentsAsync`；
- Windows 路径行为已有自动测试；
- Windows Zotero 9 的最终安装兼容性仍需在 Windows 设备上实机回归。

## 下一阶段边界

第四阶段只实现：

```text
设置 Base URL、API Key、模型名称
→ 测试连接
→ 将批注和必要原文上下文发送给模型
→ 返回 Markdown
```

开始第四阶段前需要确认配置交互方式、API Key 存储方式和实际测试模型。第四阶段仍不写回 Zotero、不导出 Markdown、不生成思维导图。
