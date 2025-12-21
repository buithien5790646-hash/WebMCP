---
hero:
  title: WebMCP
  description: 统一的 Model Context Protocol (MCP) 网关解决方案
  actions:
    - text: 快速上手
      link: /guide
    - text: GitHub
      link: https://github.com/three-water666/WebMCP
features:
  - title: 多端统一体验
    details: 无论是 VSCode 插件、浏览器扩展还是独立桌面端，都拥有完全一致的核心逻辑和操作体验。
    emoji: �
  - title: 插件化架构
    details: 基于 Monorepo 设计，共享核心逻辑 (shared)，轻松扩展新的客户端支持。
    emoji: 🛠️
  - title: 开发友好
    details: 完善的 TypeScript 支持、ESLint 检查和一键构建脚本，让开发和发布更简单。
    emoji: 💻
  - title: 文档即代码
    details: 集成 dumi 文档系统，让技术文档与代码同步更新，方便团队协作。
    emoji: 📖
---

## 为什么选择 WebMCP？

在 AI 驱动开发的时代，MCP (Model Context Protocol) 正在成为连接模型与上下文的标准。WebMCP 致力于打破平台限制，提供一个跨平台的网关，让你的 MCP 服务可以在任何地方无缝运行。

## 包含的组件

- **mcp-gateway-vscode**: 为 VSCode 用户量身定制的插件。
- **mcp-bridge-browser**: 让你的浏览器也具备 MCP 处理能力。
- **mcp-gateway-desktop**: 跨平台的桌面应用，提供最直观的管理界面。
- **shared**: 核心逻辑抽象层，保证多端逻辑同步。
