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

## 文档目录说明

```
docs/
├── README.md          # 文档首页
├── requirements/      # 产品需求文档
├── architecture/      # 架构设计文档
├── technical/         # 技术实现文档
└── prompts/           # 大模型提示词文档
```

## 开发阶段说明

当前阶段仅完成项目仓库初始化和文档目录搭建，尚未开始实现插件业务功能。

## 许可证

MIT License
