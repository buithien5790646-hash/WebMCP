# 📦 MCP Market Kit

> **The missing package manager for Model Context Protocol.**
> 为 Electron/Tauri/Node 应用提供一站式的 MCP 服务发现、安装与生命周期管理 SDK。

## ⚡ Why this?

目前在应用中集成 MCP 市场非常痛苦：
* ❌ **手动解析**：你需要自己去抓取 GitHub JSON，自己处理数据结构。
* ❌ **性能低下**：使用 `npx` / `uvx` 启动导致每次都要联网检查，启动延迟高。
* ❌ **环境地狱**：用户电脑没有安装 Python？Node 版本过低？依赖冲突？

**MCP Market Kit** 解决了这一切。它就像是 MCP 服务的 `apt-get` 或 `npm`，专为集成到宿主应用（Host Apps）中设计。

## 📦 Installation

```bash
npm install @mcp-kit/core
```

## 🚀 Quick Start

(See documentation for usage)