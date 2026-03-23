# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目背景

WebMCP 是一个通用桥梁，通过 Model Context Protocol (MCP) 将本地 VS Code 开发环境连接到各类网页版 AI (如 Gemini、ChatGPT、DeepSeek)。项目基于 PNPM Workspace 实现 monorepo 管理。

## 常用命令

- **安装依赖**: `pnpm install` (强制使用 pnpm)
- **全局构建**: `pnpm build` (将会构建所有 workspace 包)
- **代码校验**: `pnpm lint` (或者使用 `pnpm lint --fix` 自动修复 ESLint 问题)
- **运行测试**: `pnpm test` (主要运行 VS Code 扩展的自动化测试)
- **一键发布构建**:
  - macOS/Linux: `./build_release.sh`
  - Windows: `.\build_release.ps1`
  - _注意：发布构建脚本会在 `release/` 目录下生成可供分发的 `.vsix` 和 `.zip` 文件。_

### 单个子包开发

- **VS Code 扩展** (`mcp-gateway-vscode/`):
  - 监视并编译: `cd mcp-gateway-vscode && pnpm run watch`
  - 运行单元测试: `cd mcp-gateway-vscode && pnpm run test`
- **浏览器扩展** (`mcp-bridge-browser/`):
  - 启动 Vite 预览: `cd mcp-bridge-browser && pnpm run dev`
  - 生产构建: `cd mcp-bridge-browser && pnpm run build`

## 高层代码架构

该 Monorepo 由三个主要包组成：

1. **`mcp-gateway-vscode/` (VS Code 扩展网关)**
   - 运行本地 HTTP/SSE 服务器 (默认端口 34567) 监听浏览器扩展的连接请求。
   - 核心文件位于 `src/gateway.ts`，负责处理 MCP 通信、协议封装、以及动态 Token 鉴权。
   - **核心安全机制 (Human-in-the-Loop)**: 所有具有风险的操作 (如修改文件、执行命令等，参见 `src/servers/command.ts` 等文件) 在此拦截，通过 VS Code 弹窗强制要求用户审批确认 (Approve / Reject)。

2. **`mcp-bridge-browser/` (浏览器扩展桥接)**
   - 基于 Vite 和 Preact 构建的浏览器插件。
   - **`src/background/index.ts`**: 扩展后台服务，负责跨域长链接管理，维护与 VS Code Gateway 的连接生命周期及动态 Token。
   - **`src/content/`**: 内容脚本，注入到目标网页版 AI 环境 (例如 ChatGPT, Gemini 网页)，暴露出可供网页端大语言模型调用的工具/函数接口，并将 AI 的调用转发至后台。

3. **`shared/` (共享类型库: `@webmcp/shared`)**
   - 包含跨端复用的类型定义、配置约束及通信常量，确保 VS Code 与浏览器插件在交互层的数据契约一致。

## 代码风格与规范

- 该项目使用严格的 ESLint 规则（参考根目录 `eslint.config.mjs`），强制检查未使用变量等核心质量指标。
- 使用 `typescript-eslint` 并且支持自动修复。修改代码后若触发 husky pre-commit lint 失败，请运行 `pnpm lint --fix`。
- 本项目包含敏感的认证和命令执行逻辑。在处理/修改 `mcp-gateway-vscode` 相关代码时，必须保证现有的源隔离 (Origin isolation) 和人工审批 (HITL) 机制不被绕过或破坏。