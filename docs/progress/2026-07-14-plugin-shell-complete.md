# Zotero AI Notes 第一阶段验收记录（2026-07-14）

## 结论

第一阶段“插件空壳”已在 macOS 的 Zotero 9.0.6 中完成真实验收。

本阶段只包含插件安装、生命周期、文献右键菜单和测试弹窗，没有读取 PDF、批注或调用大模型。

## 安装失败根因

Zotero 错误控制台给出的实际错误是：

```text
Reading manifest: applications.zotero.update_url not provided
```

Zotero 9.0.6 因缺少 `applications.zotero.update_url` 将 XPI 判定为无效。原有 XPI 校验脚本没有检查该字段，因此此前的“校验通过”是假阳性。

## 同时修复的问题

1. 在 `addon/manifest.json` 中增加 `update_url`；
2. 在 `scripts/verify-xpi.js` 中将 `update_url` 作为必填字段，并验证 URL 格式；
3. 将文献右键菜单容器从错误的 `zotero-item-pane-context-menu` 改为 Zotero 9.0.6 实际使用的 `zotero-itemmenu`；
4. 插件在首次安装、启用和应用启动等所有启动原因下都会初始化当前已有窗口；
5. 将 Zotero 9 已弃用的 `tooltiptext` 改为 `title`；
6. 增加右键菜单注册和测试弹窗的回归测试。

## 自动测试

- TypeScript 类型检查：通过；
- ESLint：0 个错误，保留原有 19 个 `any` 类型警告；
- Vitest：2 个测试文件、9 个测试全部通过；
- XPI 构建：通过；
- XPI 结构、生命周期导出、Zotero 9.0.6 版本范围和 `update_url` 校验：通过；
- 最终 XPI SHA-256：`5ce35536108960f75c0adf1f30c4bbb707bcd562ed0fe8b39e0dbbbf67c179ac`。

## Zotero 9.0.6 实机验收

1. XPI 可以安装；
2. 插件管理器显示 `Zotero AI Notes 0.1.0` 且处于启用状态；
3. 对测试条目 `Zotero AI Notes 测试文献` 右键，只出现一个 `AI 整理批注` 菜单项；
4. 点击菜单后弹出 `Zotero AI Notes 插件加载成功`；
5. 弹窗正确显示 `当前文献：Zotero AI Notes 测试文献`；
6. 禁用插件后菜单被移除；
7. 重新启用后菜单恢复且没有重复；
8. 完全退出并重新启动 Zotero 后，菜单和测试弹窗仍然正常。

## 下一阶段边界

第二阶段只实现：

```text
选择一篇文献
→ 获取标题和 PDF 附件
→ 获取全部高亮、评论、标签和页码
→ 输出结构化 JSON
```

第二阶段仍不读取 PDF 原文、不调用大模型、不生成 Markdown 和思维导图。
