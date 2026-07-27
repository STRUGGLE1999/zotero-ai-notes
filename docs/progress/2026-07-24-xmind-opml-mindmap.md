# 2026-07-24：XMind / OPML 思维导图升级

## 目标

将用户可见的 Mermaid 源码流程替换为统一导图树、本地 SVG 预览、OPML 导出和现代 XMind 导入，并保持 Zotero 9 的离线渲染能力。

## 实现范围

- Markdown 笔记确定性转换为统一 `MindmapDocument`；
- Zotero 预览窗口只显示导图，不显示源码；
- 本地 SVG 双向布局，采用低饱和 Zotero 红与学术灰蓝配色；
- 支持缩放、拖动和适应窗口；
- 导出 OPML 2.0；
- 导入现代 XMind `content.json`，支持普通主题、纯文本备注和多画布切换；
- 第一阶段可直接导入 XMind，不依赖模型服务或笔记生成；
- 导入行为不覆盖 Markdown、Zotero 笔记或原始 XMind 文件；
- SVG 渲染失败时显示树状回退视图。

## 明确边界

当前不导入旧版 `content.xml`，也不保真还原 XMind 主题、坐标、关系线、概要、图片、附件、自由主题和密码保护内容。OPML 主要保留文字、层级和纯文本备注。

## 验证要求

- `npm run check`；
- XPI 结构和可重复构建验证；
- macOS Zotero 9 实机安装；
- 生成导图预览、无源码界面、缩放和适应窗口；
- OPML 实际保存；
- 现代 XMind 文件实际导入和多画布切换。

## 实机结果

- macOS Zotero 9 安装并启用 `0.4.0` XPI；
- Zotero 生成的 OPML 已由 XMind 成功导入；
- XMind 保存的原生 `content.json` 文件已由 Zotero 成功导入，显示 6 个节点、3 层；
- 双画布 `content.json` 文件已导入，并在 Zotero 中切换至第二张“实验结果”画布；
- 导入后的画布已再次导出为有效 OPML；
- 同版本 XPI 重装前后 Zotero 本机凭据记录保持不变，未读取或输出 API Key。
