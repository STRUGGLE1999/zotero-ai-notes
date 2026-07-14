# Zotero AI Notes 第二阶段验收记录（2026-07-14）

## 结论

第二阶段“读取当前文献和批注”已在 macOS 的 Zotero 9.0.6 中完成真实验收。

本阶段读取当前选中文献、全部 PDF 附件及 Zotero 原生批注，并将结构化结果同时写入 Zotero 调试日志和系统临时目录中的 JSON 文件。没有读取 PDF 原文、调用大模型或生成笔记。

## 实现范围

1. 支持选择一篇常规文献，也支持直接选择其 PDF 附件；
2. 常规文献存在多个 PDF 时，读取全部 PDF 并分别保存；
3. 读取文献标题、PDF 文件名、内容类型、链接模式、文件状态和文件路径；
4. 读取全部 Zotero 原生批注，并按文档位置排序；
5. 每条批注包含类型、文本、评论、颜色、标签、页码、位置和创建/修改时间；
6. 将 PDF 内部零基页码 `pageIndex` 转换为面向用户的一基页码 `pageNumber`，同时保留 PDF 页签 `pageLabel`；
7. JSON 使用 Zotero 提供的系统临时目录和文件 API 写入，并同步输出到调试日志。

## 自动测试

- TypeScript 类型检查：通过；
- ESLint：0 个错误，保留 22 个 `any` 类型警告；
- Vitest：覆盖常规文献、直接选择 PDF、无 PDF 错误、评论/标签/页码映射、右键菜单输出和 Windows 临时目录路径；
- XPI 构建及结构验证：通过；
- Manifest 的 Zotero 兼容范围：`9.0` 至 `9.0.*`；
- 第二阶段安装包构建时 SHA-256：`b8f303a58856f85476bbc86bd10fd23d675fc003a63f7fd7b7747a7758ce39f6`。

## Zotero 9.0.6 实机验收

测试文献：`NEURAL MACHINE TRANSLATION BY JOINTLY LEARNING TO ALIGN AND TRANSLATE`。

1. 阅读器侧栏显示 4 条真实批注；
2. 右键点击文献后选择“AI 整理批注”，成功弹出读取结果；
3. 插件读取到 1 个 PDF 附件和 4 条批注；
4. JSON 中包含 2 条 `highlight` 和 2 条 `underline`；
5. 四条批注的文本、颜色和位置均已保存；
6. 页码分别正确映射到第 1 页和第 2 页；
7. 当前四条真实批注没有评论和标签，因此对应字段正确输出为空字符串和空数组；有值时的映射由自动测试覆盖；
8. JSON 文件写入 macOS 系统临时目录：`zotero-ai-notes-RXKGFINC-annotations.json`；
9. 在批注创建前生成的 JSON 为 0 条，在创建后重新运行即读取到 4 条，确认不是缓存或漏读问题。

## 跨平台说明

- 运行时代码没有写死 macOS 用户目录、Windows 盘符或路径分隔符；
- 临时目录由 `PathUtils.tempDir` 获取，路径由 `PathUtils.join` 组合；
- JSON 由 `Zotero.File.putContentsAsync` 写入；
- PDF 路径直接采用 Zotero 返回值，不自行拆分或拼接；
- 构建脚本会将 XPI 内部路径统一为 `/`，符合 ZIP/XPI 规范；
- Windows 路径行为已有自动回归测试，但仍需在 Windows 的 Zotero 9 实机做最终安装回归，不能用 macOS 测试替代。

## 下一阶段边界

第三阶段只实现：

```text
获取高亮所在页面
→ 找到高亮附近原文
→ 建立内部 Evidence 数据
→ 在调试窗口展示
```

在第三阶段验收通过前，仍不接入大模型、不生成 Markdown、不写回 Zotero。
