# Zotero AI Notes 第六阶段验收记录（2026-07-14）

## 结论

第六阶段“生成思维导图”已在 macOS 的 Zotero 9.0.6 中完成真实验收，实机加载版本为 `0.3.0`。

本阶段基于已经生成并通过后台校验的 Markdown 笔记，确定性转换为 Mermaid `mindmap`，不再次调用模型，也不增加笔记之外的新事实。

## 实现范围

- 在结果预览中提供“笔记 / 思维导图”切换；
- 从已校验 Markdown 生成 Mermaid `mindmap` 源码；
- 在 Zotero XUL 预览窗口内，通过独立的标准 XHTML 渲染帧生成 SVG；
- 展示节点数量、最大层级和缩短后的根节点说明；
- 提供 Mermaid 源码查看和复制；
- 通过系统保存对话框导出 UTF-8 Mermaid Markdown 文件；
- SVG 渲染失败时保留树状结构和源码，不阻断复制或导出；
- 最终思维导图不显示内部 Evidence ID。

XMind 格式不属于本阶段，留待 Mermaid 版本稳定后的独立升级。

## 自动测试

- TypeScript 类型检查：通过；
- Vitest：11 个测试文件、36 个测试全部通过；
- XPI 构建和结构验证：通过；
- 安装包：`zotero-ai-notes-0.3.0.xpi`；
- 最终安装包 SHA-256：`ef209f512b4c0659b5ffc2c8d9773a44f8deb76145bc794ac0b5051a51b63602`；
- Zotero 插件管理接口返回：`0.3.0 enabled=true`。

## Zotero 9.0.6 实机验收

测试文献：`ImageNet classification with deep convolutional neural networks`。

实测结果：

- PDF 附件：1 个；
- 真实批注：17 条；
- 成功定位相邻原文：16/17；
- 识别关注重点：3 个；
- Gemini 笔记生成和后台校验：通过；
- Mermaid 节点：11 个；
- 最大层级：3 层；
- XHTML 渲染帧生成 SVG：通过；
- SVG 中可见节点文字：11 个；
- Mermaid 源码中的内部 Evidence ID：0 个；
- 源码复制：通过；
- Mermaid Markdown 导出：通过，UTF-8 编码。

导出文件：

```text
ImageNet_AI思维导图_0.3.0.md
```

## 渲染兼容方案

Mermaid 依赖标准 HTML DOM。直接在 Zotero 的 XUL 文档中执行 SVG 渲染会触发 DOM 兼容错误，而把整个预览窗口改成标准 XHTML 又无法由 Zotero 9 的 `openDialog` 稳定打开。

最终方案保留 XUL 作为预览窗口外壳，并在同源的标准 XHTML iframe 中运行本地 Mermaid。渲染完成后，将 SVG 返回给父窗口展示。全部资源随 XPI 本地打包，不依赖 CDN。

## 跨平台说明

- 插件业务逻辑、文件保存和 Zotero 数据访问不使用 macOS 专用 API；
- Mermaid 与渲染帧资源随 XPI 打包，不依赖系统浏览器或网络 CDN；
- 路径继续使用 Zotero/Gecko 的跨平台接口；
- 已在 macOS Zotero 9.0.6 完成实机验收；
- Windows Zotero 9 和 Linux Zotero 9 仍需分别做最终回归。

## 后续边界

下一步可在不改变现有 Mermaid MVP 的前提下，单独评估 XMind 文件结构、导出方式和跨平台打开效果。
