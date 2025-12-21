# 项目架构

WebMCP 采用 Monorepo 架构，旨在最大化代码复用。

## 目录结构

```text
.
├── packages
│   ├── shared              # 核心共享逻辑、类型定义和工具函数
│   ├── mcp-gateway-vscode  # VSCode 插件源码
│   ├── mcp-bridge-browser  # 浏览器扩展源码
│   └── mcp-gateway-desktop # Electron 桌面端源码
├── docs                    # 项目文档 (dumi)
├── build_release.sh        # 发布脚本 (Shell)
└── build_release.ps1       # 发布脚本 (PowerShell)
```

## 核心设计理念

### 1. 逻辑抽离 (Shared Package)
我们将所有与平台无关的 MCP 协议处理、数据转换和状态管理逻辑都放在 `packages/shared` 中。这样可以确保各端在核心功能上保持高度一致。

### 2. 统一构建流程
通过根目录的 `package.json` 统一管理所有子项目的依赖和构建任务。利用 `pnpm filter` 实现精准的任务调度。

### 3. 多端适配
每个子项目只负责处理其特定平台的 UI 展现和环境 API 适配（如 VSCode 的 `vscode` API，Electron 的主进程/渲染进程通信等）。
