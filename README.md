# Zotero AI Notes

根据用户在 Zotero PDF 阅读过程中的高亮和批注，结合文献原文，自动整理为可靠、自然的 Markdown 笔记和思维导图。

## 开发状态

🚧 项目初始化阶段，尚未实现核心功能。

## 计划支持版本

- Zotero 9.x

## 核心功能规划

- 读取用户在 Zotero PDF 阅读器中的高亮和批注
- 根据批注识别用户重点关注的内容
- 结合 PDF 原文和上下文生成结构化笔记
- 调用大模型时避免无中生有
- 输出 Markdown 笔记和思维导图
- 将结果保存回 Zotero

## 项目文档

项目文档存放在 [docs/](docs/README.md) 目录下，包含以下四份核心文档：

| 编号 | 文档 | 用途 |
|------|------|------|
| 01 | [产品需求文档（PRD）](docs/requirements/01_Zotero_AI批注整理插件_PRD_Zotero9版.md) | 定义产品目标、用户故事、功能需求和验收标准 |
| 02 | [产品架构设计](docs/architecture/02_Zotero_AI插件_产品架构设计_Zotero9版.md) | 设计系统架构、模块划分、数据流和核心原则 |
| 03 | [技术设计文档](docs/technical/03_Zotero_AI插件_技术设计文档_Zotero9版.md) | 描述技术栈、API 设计、数据结构和实现方案 |
| 04 | [Prompt 设计文档](docs/prompts/04_Zotero_AI插件_Prompt设计文档_Zotero9版.md) | 定义大模型提示词策略、输出格式和防幻觉约束 |

### 文档目录结构

```
docs/
├── README.md              # 文档首页与导航
├── requirements/          # 产品需求文档
├── architecture/          # 架构设计文档
├── technical/             # 技术实现文档
└── prompts/               # 大模型提示词文档
```

## 开发阶段说明

当前阶段仅完成项目仓库初始化和文档目录搭建，尚未开始实现插件业务功能。

## 许可证

MIT License
