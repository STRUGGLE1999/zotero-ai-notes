# Zotero AI Notes 2026-07-14 开发复盘

## 1. 一天结束时实现了什么

今天从“XPI 无法安装”开始，最终在 macOS 的 Zotero 9.0.6 中完成了一个可真实使用的 `0.3.0` 版本。

完整链路已经跑通：

```text
安装插件
→ 文献右键启动
→ 读取 PDF 和批注
→ 定位批注附近原文
→ 建立 Evidence
→ 调用 Gemini
→ 识别关注重点
→ 生成并校验 Markdown
→ 用户预览与编辑
→ 写回 Zotero / 导出 Markdown
→ 生成和导出 Mermaid 思维导图
```

最终在两篇真实论文上完成了实机验证：

- `NEURAL MACHINE TRANSLATION BY JOINTLY LEARNING TO ALIGN AND TRANSLATE`：用于验证 4 条批注、跨页上下文、Evidence 和 Gemini 基础链路；
- `ImageNet classification with deep convolutional neural networks`：用于验证 17 条批注、关注重点识别、完整笔记闭环和思维导图。

## 2. 开发原则

今天没有一次性开发全部功能，而是严格拆成六个阶段。每个阶段都遵守三条原则：

1. 只实现当前阶段要求，后续能力不提前混入；
2. 自动测试通过后，再在真实 Zotero 9.0.6 中安装和验收；
3. 如果真实运行结果与预期不一致，先读取 Zotero 错误信息和实际 API 行为，再做最小修复。

这种方式让每一层的责任清晰：插件壳、数据读取、PDF 上下文、模型调用、产品闭环和思维导图可以单独验证，问题不会互相掩盖。

## 3. 第一阶段：让插件真正装得上

### 目标

- 创建 Zotero 9 插件空壳；
- XPI 可以安装和启用；
- Zotero 启动后正常加载；
- 文献右键出现“AI 整理批注”；
- 点击后显示测试提示。

### 最初的问题

昨天生成的 `0.1.0` 安装时只显示“不兼容或无法安装”。最初怀疑过：

- `strict_min_version` / `strict_max_version` 不正确；
- `default_locale` 与 Zotero 的 properties 本地化目录不匹配；
- 构建目录残留旧文件；
- 打包后的生命周期函数没有暴露到全局；
- XPI 根目录结构不正确。

这些都值得检查，但真正根因不能靠猜。

### 根因与解决

在 Zotero 错误控制台中捕获到真实错误：

```text
Reading manifest: applications.zotero.update_url not provided
```

Zotero 9.0.6 要求清单中提供 `applications.zotero.update_url`。原来的 XPI 校验脚本没有检查它，所以此前“构建和校验成功”实际上是假阳性。

处理内容包括：

- 在 `manifest.json` 中增加 `update_url`；
- 扩展 XPI 校验脚本，把 `update_url` 和 URL 格式加入必检项；
- 将右键菜单挂载点改为 Zotero 9.0.6 实际使用的 `zotero-itemmenu`；
- 初始化当前已打开的 Zotero 窗口，并处理安装、启用和应用启动等生命周期；
- 将弃用的 `tooltiptext` 改为 `title`；
- 验证禁用、重新启用和重启后菜单不会重复。

### 验收结果

`0.1.0` 成功安装、启用、显示菜单并弹出测试提示。第一阶段完全不读取 PDF，也不调用 AI。

## 4. 第二阶段：读取真实文献和批注

### 实现内容

- 支持选中文献父条目，也支持直接选中 PDF 附件；
- 读取一篇文献下的全部 PDF 附件；
- 读取高亮、下划线、评论、标签、颜色、页码、位置和时间；
- 按文档位置排序批注；
- 同时保留 PDF 内部零基页码和用户可读的一基页码；
- 将结构化 JSON 输出到 Zotero 调试日志和系统临时目录。

### 实际发现

第一轮 JSON 中出现 0 条批注，并不是读取逻辑缓存，而是测试文献当时还没有 Zotero 原生批注。创建批注后重新执行，插件立即读取到 4 条。这次验证说明测试数据状态也必须纳入排查，不能把所有异常都归因于代码。

### 跨平台处理

临时目录和路径组合全部使用 `PathUtils.tempDir`、`PathUtils.join` 和 Zotero 文件 API，不拼接 macOS 路径，也不假设 Windows 盘符或分隔符。

## 5. 第三阶段：从批注走到原文 Evidence

### API 核对

通过 Zotero 9.0.6 的实际实现确认，`Zotero.PDFWorker.getFullText()` 可以按指定页面提取文本。因此插件不需要引入第三方 PDF 解析库，也不需要读取整篇 PDF，只请求存在批注的页面。

### 定位策略

1. 规范化高亮文本后做精确匹配；
2. 精确匹配失败时按关键词覆盖率做模糊匹配；
3. 对被 PDF 拆分为多个相邻短批注的连续选择，复用相邻 Evidence 上下文；
4. 页面无文本或无法可靠定位时，保留批注本身并给出警告；
5. 单字符英文按独立词匹配，避免把 `y` 错配到 `probability`；
6. 上下文限制为当前段落及前后各一段，并设置长度上限。

### Evidence 的作用

Evidence 是插件内部的数据层，记录批注、页码、原文上下文、定位方式和内容哈希。它既用于约束模型，又用于后续后台校验，但不会直接污染最终用户笔记。

NMT 测试文献的 4 条批注全部建立 Evidence，原文定位为 4/4。

## 6. 第四阶段：接入 Gemini

### 配置设计

- Base URL：`https://generativelanguage.googleapis.com/v1beta/openai/`；
- API Key：保存到 Zotero/Firefox Login Manager；
- 模型：支持填写当前账号可用的 Gemini 模型；
- 设置页提供保存、测试连接和清除 Key；
- 界面只显示 Key 是否已保存，不回显真实值；
- 日志不记录 API Key、Authorization 头或完整请求正文。

Gemini 虽然在普通产品界面里常常只要求 API Key，但其 OpenAI 兼容接口仍有可配置 Base URL。插件提供默认值，同时保留可修改能力。

### 数据发送边界

插件没有上传整篇 PDF，只发送生成所需的标题、批注、评论、标签、页码和附近原文 Evidence。

### 阶段结果

NMT 文献的 4 条 Evidence 成功发送给 Gemini，返回 Markdown，引用覆盖为 4/4，未出现不存在的 Evidence ID。

## 7. 第五阶段：形成可用产品闭环

这一阶段从“模型能够返回 Markdown”提升到“用户能够完成一次工作”。

### 新增能力

- 根据批注和上下文识别用户关注重点；
- 用户可以取消主题或调整优先级；
- 按确认后的重点生成自然笔记；
- 使用本地规则和 Gemini 做后台校验；
- 提供 Markdown 编辑区和渲染预览；
- 校验通过后允许写回 Zotero 或导出 Markdown；
- 写回时创建新的子笔记，不覆盖已有笔记；
- 生成元数据保留模型、模板、上下文模式、Evidence 数量和插件版本。

### 为什么最终笔记不显示 Evidence ID

早期生成结果在每段后出现类似 `[E-XXXX-1-01]` 的内部 ID。它们有利于机器校验，却严重影响阅读体验。

最终采用双层结构：

- 内部：继续保留 Evidence ID，供生成约束和后台校验；
- 用户界面、Zotero 笔记和导出文件：只展示自然内容，不展示内部 ID。

### 版本迭代

- `0.2.0`：完成关注重点、生成、校验、预览、写回和导出主体；
- `0.2.1`：修复最终正文中内部 Evidence ID 的展示问题；
- `0.2.2`：修复预览窗口和闭环交互中的实机问题；
- `0.2.3`：兼容 Gemini 把批注 ID 返回为 JSON 数字的情况。

`0.2.3` 的问题很典型：提示词要求字符串 ID，但模型可能返回数字 `5`。原解析器只接受字符串，导致真实批注支持被误判为空。解决方案是把可接受的数字和字符串统一规范化为字符串，并增加回归测试，同时在提示词中再次强调原样复制 ID。

### ImageNet 实机结果

- 17 条真实批注；
- 16/17 条定位到附近原文；
- 识别出 3 个关注重点；
- 生成和后台校验通过；
- 写回 Zotero 成功，新建子笔记且没有覆盖原笔记；
- Markdown 导出成功；
- 用户可见正文中的 Evidence ID 为 0。

## 8. 第六阶段：Mermaid 思维导图

思维导图被放到最后开发，因为它必须建立在稳定笔记之上。当前实现不会重新调用模型，而是把已校验 Markdown 确定性转换为 Mermaid `mindmap`，避免思维导图产生笔记之外的新事实。

### 经历的渲染问题

Mermaid 默认假设运行在标准 HTML DOM 中，而 Zotero 插件预览窗口使用 XUL。连续出现了几类错误：

```text
can't access property "firstChild", x is null
can't access property "getAttribute", i is null
can't access property "insertBefore", a is null
```

尝试过程包括：

1. 直接在 XUL 文档中调用 Mermaid；
2. 为 Mermaid 显式传入渲染容器；
3. 在 XUL 中加入 HTML body；
4. 把整个预览窗口改成标准 XHTML。

前三种方案仍然会碰到 XUL DOM 语义差异；第四种方案虽然满足 Mermaid，却无法由 Zotero 9 的 `openDialog` 稳定打开。

### 最终方案

保留 Zotero 能稳定打开的 XUL 预览窗口，在其中嵌入一个同源、离屏的标准 XHTML iframe：

```text
XUL 预览窗口
→ 标准 XHTML 渲染帧
→ 本地 Mermaid 生成 SVG
→ 将 SVG 返回父窗口展示
```

Mermaid 脚本和渲染帧全部随 XPI 本地打包，不依赖 CDN。即使 SVG 渲染失败，树状结构、源码复制和导出仍可使用，避免一个展示层错误阻断用户数据。

### 最终结果

ImageNet 笔记生成了 11 个节点、3 层的 Mermaid 思维导图。SVG、节点文字、源码复制和 UTF-8 Markdown 导出均通过实机测试，Evidence ID 为 0。

## 9. 版本总览

| 版本 | 作用 | 关键结果 |
|---|---|---|
| `0.1.0` | 插件空壳 | 安装、加载、右键菜单、测试提示 |
| `0.1.1` | 数据读取 | 文献、PDF、批注和 JSON |
| `0.1.2` | Evidence 与 Gemini | PDF 上下文、连接测试、Markdown 返回 |
| `0.2.0` | 完整闭环 | 重点、生成、校验、预览、写回、导出 |
| `0.2.1` | 输出清理 | 最终笔记移除内部 Evidence ID |
| `0.2.2` | 实机修复 | 预览窗口和交互稳定性 |
| `0.2.3` | 模型兼容 | 数字形式批注 ID 规范化 |
| `0.3.0` | 思维导图 | Mermaid SVG、源码复制和导出 |

## 10. 测试策略与最终质量状态

今天使用了三层验证：

1. 单元测试：覆盖批注映射、Evidence、Gemini 请求与解析、笔记校验、Markdown 和 mindmap；
2. 构建验证：检查 TypeScript、ESLint、XPI 根目录、清单字段、生命周期导出和压缩包完整性；
3. Zotero 实机验证：每个阶段都在 Zotero 9.0.6 中重新安装并使用真实论文测试。

最终 `0.3.0` 状态：

- TypeScript 类型检查通过；
- ESLint 0 个错误，仍有 45 个主要来自 Zotero 动态接口的 `any` 警告；
- 11 个测试文件、36 个测试全部通过；
- XPI 构建和压缩包检查通过；
- 实机插件状态：`0.3.0 enabled=true`；
- 已验收安装包 SHA-256：`ef209f512b4c0659b5ffc2c8d9773a44f8deb76145bc794ac0b5051a51b63602`。

## 11. 跨平台设计

虽然今天主要在 macOS 开发和验收，但实现中避免了 macOS 专用依赖：

- 使用 Zotero/Gecko 路径和文件 API；
- 使用 Zotero PDF Worker，而不是系统 PDF 工具；
- 使用 Zotero 网络能力和 Login Manager；
- 使用 Zotero 数据 API 写回笔记；
- 使用系统文件选择器导出；
- XPI 内部统一使用 `/` 路径；
- Mermaid 资源本地打包，不依赖系统浏览器。

Windows 路径行为已经有自动测试，但 Windows Zotero 9 和 Linux Zotero 9 仍需实机回归，不能把 macOS 成功等同于所有平台成功。

## 12. 今天最重要的经验

### 先获取真实错误，再决定修复方向

安装失败时有多个合理猜测，但只有 Zotero 错误控制台指出了缺失 `update_url` 的真正原因。运行时兼容问题也必须以实际错误栈和 DOM 行为为依据。

### 自动测试不能代替宿主应用测试

测试和构建都能通过，XPI 仍可能无法安装；XML 能通过解析，Mermaid 仍可能不兼容 XUL。Zotero 插件必须保留真实安装、启停、重启和交互测试。

### 内部可靠性信息与用户阅读体验应分层

Evidence ID 对模型约束和校验很重要，但不适合作为正式笔记的一部分。内部结构化、外部自然化是这个插件的重要产品原则。

### 复杂功能应建立在稳定数据层上

Gemini、写回、导出和思维导图都依赖前面阶段的数据正确性。按层推进减少了返工，也让每次异常能够快速定位到数据、模型、窗口还是渲染层。

### 降级能力本身就是产品能力

PDF 原文无法定位时保留批注并告警；SVG 无法渲染时保留树和 Mermaid 源码。可靠的软件不要求所有外部条件永远完美，而是要保证失败时用户仍能拿到核心结果。

## 13. 仍需继续的工作

- 在 Windows Zotero 9 和 Linux Zotero 9 上完成安装、凭据、网络、保存和 SVG 回归；
- 为扫描件、无文本 PDF 和复杂双栏排版增加更明确的处理策略；
- 逐步减少 Zotero 动态 API 位置的 `any` 类型警告；
- 增加可配置的笔记模板和 Prompt 模板；
- 优化多篇文献、批注数量较多时的性能和模型输入预算；
- 在 Mermaid 稳定后单独设计 XMind 格式导出；
- 完善 GitHub Release、签名、更新清单和自动发布流程。

## 14. 当前可交付效果

现在用户可以导入一篇新论文，在 Zotero 中留下高亮和评论，然后通过一次右键操作完成从阅读痕迹到可编辑笔记和思维导图的转换。

这个版本已经不只是技术演示：它具备真实数据读取、原文约束、模型配置、安全凭据存储、后台校验、人工确认、Zotero 写回和文件导出，形成了一个完整、可验证、可继续迭代的 MVP。
