# Zotero AI Notes 开发进度（2026-07-13）

## 一、项目定位

当前只开发 Zotero 9 插件，暂不扩展为独立的 AI Research Copilot。

插件目标：

1. 用户在 Zotero 阅读 PDF；
2. 用户完成高亮、批注和标签；
3. 大模型根据批注判断用户重点关注内容；
4. 大模型结合 PDF 原文和上下文整理笔记；
5. 最终输出自然、完整的 Markdown 笔记或思维导图；
6. 插件内部执行依据映射和防幻觉检查，但最终笔记默认不展示 Evidence ID、文章事实、AI 推断等技术标签；
7. 不允许无中生有，数字、结论、作者观点和用户观点必须忠实于文献或用户批注。

## 二、已完成工作

### 1. 产品与设计文档

已完成并放入仓库：

- 产品需求文档（PRD）；
- 产品架构设计；
- 技术设计文档；
- Prompt 设计文档。

文档已统一更新为 Zotero 9.x 目标版本。

### 2. GitHub 仓库

仓库：`STRUGGLE1999/zotero-ai-notes`

已完成：

- 本地 Git 仓库初始化；
- GitHub 仓库创建；
- 文档目录整理；
- `main` 分支保存项目初始化和文档；
- 插件开发分支：`feat/plugin-shell`。

### 3. 第一阶段插件空壳

TRAE IDE 已生成：

- `package.json`；
- `tsconfig.json`；
- ESLint 配置；
- Zotero 插件生命周期代码；
- 文献右键菜单代码；
- 当前文献识别逻辑；
- 测试弹窗；
- 中英文资源文件；
- 构建脚本；
- XPI 校验脚本；
- 单元测试。

自动验证结果：

- `npm install` 成功；
- TypeScript 编译通过；
- ESLint 无错误，但仍有约 19 个 `any` 类型警告；
- 8 个单元测试通过；
- 成功生成 `zotero-ai-notes-0.1.0.xpi`。

## 三、当前阻塞问题

### XPI 无法安装到 Zotero 9.0.6

用户当前 Zotero 版本：`9.0.6`。

安装时报错：

> 无法安装插件 `zotero-ai-notes-0.1.0.xpi`。它可能无法与该版本的 Zotero 兼容。

已排查并尝试：

1. 将 `strict_max_version` 从 `9.999` 改为 `9.0.*`；
2. 一度将 `strict_min_version` 改为 `8.999`，但该做法不合理，应恢复为 `9.0`；
3. 增加 XPI 校验脚本；
4. 检查 XPI 根目录是否包含 `manifest.json` 和 `bootstrap.js`。

目前最可疑的问题：

- `manifest.json` 中仍存在 `"default_locale": "en-US"`；
- 安装包内使用的是 `locale/en-US/*.properties`，而不是 WebExtension 的 `_locales/en_US/messages.json`；
- `default_locale` 与当前本地化目录结构不匹配，可能导致 Zotero 在安装阶段拒绝清单；
- 构建脚本尚未在每次构建前彻底清理旧 `build` 目录和旧 XPI；
- 还需要确认最终打包后的 `bootstrap.js` 是否在全局作用域真正暴露 `startup`、`shutdown`、`install`、`uninstall`。

## 四、明天第一优先级

不要开发批注读取、大模型、Markdown 或思维导图。

先只修复 XPI 安装问题：

1. 从 `manifest.json` 删除 `default_locale`；
2. 将版本范围恢复为：

```json
"strict_min_version": "9.0",
"strict_max_version": "9.0.*"
```

3. 构建前删除旧 `build` 目录和旧 XPI；
4. 重新构建并校验 XPI 根目录；
5. 检查最终 `bootstrap.js` 的四个生命周期函数是否在全局可调用；
6. 在 Zotero 9.0.6 中重新安装；
7. 若仍失败，打开 Zotero 错误控制台，清空日志后重新安装，复制完整红色错误。

## 五、安装问题解决后的验收顺序

1. 插件可以安装；
2. 插件列表显示 `Zotero AI Notes 0.1.0`；
3. 插件处于启用状态；
4. 文献右键出现“AI 整理批注”；
5. 点击后显示正确文献标题；
6. PDF 附件能识别父文献标题；
7. 禁用再启用后菜单不重复；
8. 重启 Zotero 后仍然正常。

只有上述全部通过后，才进入下一阶段：读取 PDF 批注。

## 六、下一阶段规划

安装和插件空壳验收通过后，下一阶段只做：

```text
选择一篇文献
→ 获取 PDF 附件
→ 读取高亮、评论、标签和页码
→ 输出结构化 JSON
```

暂时仍不接入大模型。

## 七、协作方式

- ChatGPT：负责需求拆分、技术审查、验收标准和修复提示词；
- TRAE IDE：负责代码实现、本地构建、Git 提交和 Zotero 联调；
- 用户：负责在 Zotero 9.0.6 中完成真实安装和界面测试；
- GitHub：作为项目状态和代码的长期记录。

明天新开对话时，可直接说：

> 继续 Zotero AI Notes 项目。先读取 `docs/progress/2026-07-13-development-progress.md`，从 XPI 无法安装到 Zotero 9.0.6 的问题继续。
