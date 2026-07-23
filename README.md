# Zotero AI Notes

面向 Zotero 9 的 AI 论文批注整理插件。它会读取用户在 PDF 中留下的高亮、评论、标签和页码，结合批注附近的原文，生成经过后台校验的 Markdown 笔记，并进一步生成 Mermaid 思维导图。

> 最新公开测试版：`0.3.8`；已实机验证：macOS + Zotero `9.0.6`。
> Windows / Linux 使用同一套跨平台接口，仍需分别完成一次实机回归。

## 已实现功能

- 安装后在文献右键菜单中提供“AI 整理批注”；
- 读取当前文献、全部 PDF 附件和 Zotero 原生批注；
- 获取高亮、评论、标签、颜色、页码及位置信息；
- 只读取有批注的 PDF 页面，并定位高亮前后原文；
- 建立内部 Evidence 数据，用于约束生成内容和后台校验；
- 配置 Gemini、OpenAI 兼容、DeepSeek 或自定义服务的 Base URL、API Key 和模型，并测试连接；
- 自动识别用户关注重点，允许勾选主题并将最多两个主题设为重点；
- 采用“确认关注重点 → 生成与审查 → 查看与保存”的分阶段界面；
- 大纲在本地快速整理，笔记生成后先进行本地风险校验；无明确风险时只调用模型 1 次，有风险时才追加模型审查校正，并显示耗时、调用次数和失败原因；
- 支持真正取消模型请求，并从失败或取消阶段继续重试，保留已完成结果；
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
→ 所选模型规划并生成 Markdown
→ 本地风险校验，仅在检测到异常 Evidence ID、数字、映射或低置信度时追加模型审查校正
→ 用户预览与编辑
→ 写回 Zotero / 导出 Markdown
→ 生成 Mermaid 思维导图
```

## macOS 安装与使用教程

以下步骤面向当前已经实机验证的环境：macOS + Zotero `9.0.6`。当前 XPI 的兼容范围为 Zotero `9.0` 至 `9.0.*`。

### 1. 安装前准备

请先确认：

- 已安装并至少启动过一次 Zotero 9；
- macOS 可以正常访问准备使用的 AI 模型服务；
- 已准备对应服务的 API Key、Base URL 和模型名称；
- 如果手头没有现成的 XPI，需要安装 Node.js 18 或更高版本和 npm，从源码构建安装包。

Zotero 版本可以从 macOS 顶部菜单“Zotero → 关于 Zotero”查看。

### 2. 获取 XPI 安装包

#### 方式 A：从 GitHub Releases 下载（推荐）

- [下载最新公开测试版 0.3.8](https://github.com/STRUGGLE1999/zotero-ai-notes/releases/download/v0.3.8/zotero-ai-notes-0.3.8.xpi)
- [查看并下载全部历史版本](https://github.com/STRUGGLE1999/zotero-ai-notes/releases)

下载后直接进入下一步，不要解压 XPI 文件。如果浏览器尝试打开 `.xpi`，请右键下载链接并选择“链接另存为”。

#### 方式 B：在 Mac 上从源码构建

打开 macOS“终端”，依次执行：

```bash
git clone https://github.com/STRUGGLE1999/zotero-ai-notes.git
cd zotero-ai-notes
npm install
npm run build
```

构建成功后，可以在项目根目录看到：

```text
zotero-ai-notes-0.3.8.xpi
```

如需在安装前完整检查安装包，可继续执行：

```bash
node scripts/verify-xpi.js
```

终端最后显示 `XPI verification PASSED`，表示清单、生命周期函数、目录结构和 Zotero 9.0.6 兼容范围检查通过。

### 3. 在 Zotero 中安装插件

1. 打开 Zotero 9；
2. 点击 macOS 顶部菜单“工具 → 插件”；
3. 在插件管理器右上角点击齿轮按钮；
4. 选择“Install Plugin From File…”或“从文件安装插件…”；
5. 选择从源码构建的 `zotero-ai-notes-0.3.8.xpi`，或从 Releases 下载的公开版本 XPI；
6. 在确认窗口中允许安装；
7. 检查插件列表中是否出现对应版本的 `Zotero AI Notes`，并确认状态为启用。

如果安装后右键菜单暂时没有出现，完全退出 Zotero，再重新打开一次。

### 4. 配置 AI 模型

1. 点击 macOS 顶部菜单“Zotero → 设置”；
2. 打开“Zotero AI Notes”设置页；
3. 填写以下内容：

   - API 提供商：选择 Gemini、OpenAI 兼容、DeepSeek 或自定义 OpenAI 兼容服务；
   - Base URL：填写服务商提供的 OpenAI 兼容接口地址；Gemini 官方示例为 `https://generativelanguage.googleapis.com/v1beta/openai/`；
   - API Key：填写所选服务商提供的 Key；
   - 模型：填写当前 API Key 实际可用的模型名称。

4. 点击“保存”；
5. 点击“测试连接”；
6. 等待界面显示“连接成功，API Key 和模型可用”。

API Key 只保存在本机 Zotero/Firefox Login Manager 中。设置页不会回显完整 Key，插件也不会把 Key 写入日志、调试文件或导出的笔记。

### 5. 导入一篇新的论文 PDF

1. 将论文 PDF 直接拖入 Zotero 文献列表；
2. 如果 Zotero 自动识别到论文元数据，确认标题和作者正确；
3. 如果 PDF 仍是独立附件，可以右键 PDF，选择“从 PDF 获取元数据”或为它创建父条目；
4. 双击 PDF，在 Zotero 内置阅读器中打开论文。

插件既支持选中文献父条目，也支持直接选中 PDF 附件。为了让生成笔记和写回结果的归属更清晰，推荐先创建父条目。

### 6. 为论文添加测试批注

在 Zotero PDF 阅读器中使用高亮或下划线工具。建议第一次完整测试准备：

- 至少 5 条高亮或下划线；
- 至少 1～2 条带有个人想法的评论；
- 批注尽量分布在不同页面；
- 可以为部分批注添加标签；
- 优先标记研究问题、方法、关键结论、局限性或你真正关心的内容。

批注会由 Zotero 自动保存。完成后返回文献列表。

### 7. 生成 AI 笔记

1. 在 Zotero 文献列表中选中论文父条目，或选中对应 PDF；
2. 右键点击“AI 整理批注”；
3. 等待插件读取 PDF、批注和批注所在页面的附近原文；
4. 在“关注重点”区域检查插件识别出的主题；
5. 取消不需要的主题，或将最多两个主题设为重点；
6. 如有额外要求，可以在输入框中填写，例如“重点解释研究方法，不要扩展批注之外的内容”；
7. 点击“生成笔记”；
8. 等待本地大纲整理、笔记生成和风险校验；只有检测到明确风险时才会追加模型审查校正。

生成完成后默认显示渲染后的笔记预览；如需修改，可切换到“Markdown 编辑”。正式内容不会显示插件内部使用的 Evidence ID。

### 8. 检查、写回和导出

生成完成后可以执行：

- **编辑 Markdown**：切换到“Markdown 编辑”后修改内容；
- **校验当前内容**：修改后重新执行后台校验；
- **写回 Zotero**：在当前论文下创建新的子笔记，不覆盖已有笔记；
- **导出 Markdown**：通过 macOS 保存窗口选择文件名和保存位置；
- **查看思维导图**：切换到“思维导图”标签查看 Mermaid SVG；
- **复制 Mermaid 源码**：复制后可粘贴到支持 Mermaid 的 Markdown 工具；
- **导出思维导图**：保存包含 Mermaid `mindmap` 源码的 UTF-8 Markdown 文件。

### 9. 完整流程测试清单

使用新论文测试时，可以按下面的清单逐项确认：

- [ ] Zotero 插件列表显示对应版本的 `Zotero AI Notes` 且已启用；
- [ ] 文献右键菜单只出现一个“AI 整理批注”；
- [ ] 插件显示的论文标题正确；
- [ ] PDF 数量和批注数量正确；
- [ ] 大部分批注能够定位到附近原文；
- [ ] 关注重点与自己的批注意图一致；
- [ ] 可以勾选主题、设置最多两个重点主题，且不再出现数字优先级下拉框；
- [ ] 所选模型成功返回 Markdown，阶段耗时和调用次数正常更新；
- [ ] “取消生成”能中止当前请求，失败后能从当前阶段重试；
- [ ] 后台校验通过，或明确显示需要补充的内容；
- [ ] 正式笔记中没有类似 `E-XXXX-1-01` 的内部 Evidence ID；
- [ ] “写回 Zotero”创建了新笔记，没有覆盖旧笔记，顶部状态会结束并显示“已写回 Zotero”；
- [ ] Markdown 文件能够正常保存和打开；
- [ ] 思维导图能显示节点，Mermaid 源码能够复制和导出。

### 10. macOS 常见问题

#### 安装时显示“无法安装插件”

- 确认 Zotero 是 9.0.x；
- 确认选择的是 `.xpi` 文件，而不是解压后的目录；
- 重新执行 `npm run build` 和 `node scripts/verify-xpi.js`；
- 打开“工具 → 开发者 → Error Console”，重新安装并查看最新红色错误。

#### 没有“AI 整理批注”右键菜单

- 确认插件处于启用状态；
- 选中文献条目或 PDF 附件后再右键；
- 完全退出并重新启动 Zotero；
- 检查是否同时安装了多个旧版本。

#### 提示没有批注

- 确认批注是在 Zotero PDF 阅读器中创建的原生批注；
- 返回文献列表后重新运行插件；
- 确认当前选中的是包含该 PDF 的父条目或 PDF 本身。

#### 模型连接失败

- 检查 API Key 是否保存成功；
- 检查 Base URL 是否与服务商提供的 OpenAI 兼容地址一致，并以 `/` 结尾；
- 检查填写的模型是否对当前 API Key 可用；
- 确认当前网络环境可以访问所选模型服务的 API。

#### 插件窗口没有出现在最前面

从 macOS 顶部菜单选择“窗口 → Zotero AI Notes”，即可切换到已经打开的预览窗口。

#### 部分批注没有找到附近原文

扫描件、图片型 PDF、复杂双栏排版、公式或非常短的单字符批注可能无法稳定定位。插件会保留原始批注并显示警告，不会因此丢弃批注。

#### 思维导图没有显示 SVG

插件仍会保留树状结构和 Mermaid 源码。可以先复制或导出源码，再将错误信息反馈到项目 Issues。

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
zotero-ai-notes-0.3.8.xpi
```

当前自动验证结果：

- TypeScript 类型检查通过；
- ESLint 0 个错误；
- 12 个测试文件、56 个测试全部通过；
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
| `0.3.1` | 小窗口与 Windows 布局修复、多模型提供商、Markdown 预览和识别失败重试 |
| `0.3.2`–`0.3.5` | 延长生成超时、细化进度、兼容 Chat Completions 与 Responses API 返回格式并自动回退 |
| `0.3.6` | 生成阶段、耗时、调用次数、真正取消和从当前阶段重试 |
| `0.3.7` | 修复 Zotero 沙箱取消机制导致的识别失败，并完善中英文数字单位校验 |
| `0.3.8` | 分阶段生成界面、重点主题交互、本地大纲与按风险追加模型审查、精确到秒的笔记标题、写回保护及 XHTML 分段预览修复 |

详细变更见 [CHANGELOG.md](CHANGELOG.md)。

## 版本与发布策略

项目采用语义化版本。补丁版本用于缺陷和兼容性修复，次版本用于一组完整的新能力，`1.0.0` 留给完成跨平台回归、兼容策略和稳定性验收后的首个稳定版。版本号不是小数，例如 `0.10.0` 晚于 `0.9.0`。

GitHub Releases 只发布值得用户集中下载的版本：新的次版本或主版本、重要功能里程碑、修复无法安装/启动/生成/数据安全问题的关键补丁，以及明确面向用户的公开测试版。内部测试版和普通小修复可以只保留在代码与 CHANGELOG 中，不必逐个创建 Release。跨平台稳定版门槛达成前，`0.x` Release 默认标记为 Pre-release。

`0.3.8` 明显减少了常规生成路径中的模型调用，重构了核心交互，并修复了笔记预览无法正确分段的问题，因此作为公开 Pre-release 发布。更完整的规则见 [AGENTS.md](AGENTS.md)。

## 后续计划

- 在 Windows Zotero 9 和 Linux Zotero 9 上完成实机回归；
- 优化无文本 PDF、扫描件和复杂排版的上下文定位；
- 增加可配置的笔记模板；
- 在 Mermaid 稳定后评估 XMind 格式导出；
- 继续验证 GitHub Releases 自动更新在 Windows 和 Linux 上的兼容性。

## 许可证

[MIT License](LICENSE)
