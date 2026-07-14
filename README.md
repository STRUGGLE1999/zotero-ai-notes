# Zotero AI Notes

面向 Zotero 9 的 AI 论文批注整理插件。它会读取用户在 PDF 中留下的高亮、评论、标签和页码，结合批注附近的原文，生成经过后台校验的 Markdown 笔记，并进一步生成 Mermaid 思维导图。

> 当前版本：`0.3.0`；已实机验证：macOS + Zotero `9.0.6`。
> Windows / Linux 使用同一套跨平台接口，仍需分别完成一次实机回归。

## 已实现功能

- 安装后在文献右键菜单中提供“AI 整理批注”；
- 读取当前文献、全部 PDF 附件和 Zotero 原生批注；
- 获取高亮、评论、标签、颜色、页码及位置信息；
- 只读取有批注的 PDF 页面，并定位高亮前后原文；
- 建立内部 Evidence 数据，用于约束生成内容和后台校验；
- 配置 Gemini Base URL、API Key 和模型，并测试连接；
- 自动识别用户关注重点，允许勾选和调整优先级；
- 生成、编辑和预览自然 Markdown 笔记；
- 后台检查 Evidence 引用、缺失内容和潜在幻觉；
- 将结果写回为 Zotero 子笔记，或导出 UTF-8 Markdown；
- 从已校验笔记生成 Mermaid 思维导图，支持 SVG 预览、源码复制和导出；
- 用户可见的笔记和思维导图不显示内部 Evidence ID。

## 工作流程

```text
选择 Zotero 文献
→ 读取 PDF 和批注
→ 定位批注附近原文
→ 建立内部 Evidence
→ 识别用户关注重点
→ Gemini 生成 Markdown
→ 后台校验
→ 用户预览与编辑
→ 写回 Zotero / 导出 Markdown
→ 生成 Mermaid 思维导图
```

## 安装

1. 下载或在项目根目录构建 `zotero-ai-notes-0.3.0.xpi`；
2. 打开 Zotero 9；
3. 进入“工具 → 插件”；
4. 点击插件管理器右上角齿轮，选择“Install Plugin From File…”；
5. 选择 XPI 文件并完成安装。

当前 XPI 的 Zotero 兼容范围为 `9.0` 至 `9.0.*`。

## 配置 Gemini

打开“Zotero 设置 → Zotero AI Notes”，填写：

- Base URL：`https://generativelanguage.googleapis.com/v1beta/openai/`
- API Key：从 Google AI Studio 获取的 Gemini API Key；
- 模型：例如 `gemini-3.1-flash-lite`，也可以填写当前账号可用的其他 Gemini 模型。

先点击“保存”，再点击“测试连接”。看到“连接成功，API Key 和模型可用”后即可使用。

API Key 只保存在 Zotero/Firefox Login Manager 中，不会写入设置文件、调试日志或导出的笔记。

## 使用方法

1. 将论文 PDF 导入 Zotero，并尽量为独立 PDF 创建父条目；
2. 在 Zotero PDF 阅读器中完成高亮、评论或标签；
3. 回到文献列表，选中论文父条目或 PDF 附件；
4. 右键点击“AI 整理批注”；
5. 检查插件识别出的关注重点，按需要取消主题或调整优先级；
6. 点击“生成笔记”，检查 Markdown 和后台校验结果；
7. 根据需要写回 Zotero、导出 Markdown，或切换到“思维导图”查看和导出 Mermaid。

建议第一次测试至少准备 5 条高亮，并在其中加入 1～2 条评论，且覆盖不同页面。这样更容易验证关注重点识别和上下文定位能力。

如果 macOS 上预览窗口没有出现在最前面，可从系统顶部菜单“窗口 → Zotero AI Notes”切换到插件窗口。

## 数据与隐私

- 插件不会把整篇 PDF 上传给模型；
- 只发送生成所需的文献标题、批注、用户评论、标签、页码和附近原文；
- API Key 不会进入请求日志；
- 写回 Zotero 时创建新的子笔记，不覆盖已有笔记；
- 调试 JSON 和阶段性 Markdown 使用系统临时目录或用户选择的保存位置。

## 本地开发

环境要求：

- Node.js 18 或更高版本；
- npm；
- Zotero 9。

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

构建完成后，项目根目录会生成：

```text
zotero-ai-notes-0.3.0.xpi
```

当前自动验证结果：

- TypeScript 类型检查通过；
- ESLint 0 个错误；
- 11 个测试文件、36 个测试全部通过；
- XPI 结构与压缩包完整性检查通过。

## 项目结构

```text
addon/                  Zotero 清单、设置页、预览窗口和本地化资源
src/config/             配置与凭据存储
src/zotero/             文献、附件、批注和右键菜单
src/evidence/           PDF 上下文定位与 Evidence 构建
src/llm/                Gemini 请求、生成和后台校验
src/output/             Markdown、Zotero 写回与 Mermaid 输出
src/ui/                 预览窗口控制器
tests/                  自动测试
docs/                   PRD、架构、技术、Prompt 和阶段验收文档
scripts/                构建及 XPI 验证脚本
```

## 文档

- [文档导航](docs/README.md)
- [产品需求文档](docs/requirements/01_Zotero_AI批注整理插件_PRD_Zotero9版.md)
- [产品架构设计](docs/architecture/02_Zotero_AI插件_产品架构设计_Zotero9版.md)
- [技术设计文档](docs/technical/03_Zotero_AI插件_技术设计文档_Zotero9版.md)
- [Prompt 设计文档](docs/prompts/04_Zotero_AI插件_Prompt设计文档_Zotero9版.md)
- [2026-07-14 完整开发复盘](docs/progress/2026-07-14-development-retrospective.md)

## 版本历程

| 版本 | 主要内容 |
|---|---|
| `0.1.0` | Zotero 9 插件空壳、安装、生命周期、右键菜单和测试提示 |
| `0.1.1` | 文献、PDF 附件和批注结构化读取 |
| `0.1.2` | PDF 上下文、Evidence、Gemini 配置和 Markdown 返回 |
| `0.2.0` | 关注重点、生成、校验、预览、写回和导出闭环 |
| `0.2.1`–`0.2.3` | Evidence ID 展示、窗口交互和 Gemini 数字批注 ID 等问题修复 |
| `0.3.0` | Mermaid 思维导图、SVG 预览、源码复制和导出 |

详细变更见 [CHANGELOG.md](CHANGELOG.md)。

## 后续计划

- 在 Windows Zotero 9 和 Linux Zotero 9 上完成实机回归；
- 优化无文本 PDF、扫描件和复杂排版的上下文定位；
- 增加可配置的笔记模板；
- 在 Mermaid 稳定后评估 XMind 格式导出；
- 完善发布、升级和自动更新流程。

## 许可证

[MIT License](LICENSE)
