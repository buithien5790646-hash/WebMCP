# mcp2api (Web AI Local Bridge)

[中文](#中文说明) | [English](#english-description)

**mcp2api** 是一个连接 **Web 版 AI** (ChatGPT / Gemini) 与 **本地计算机** 的桥接工具。它通过 **Model Context Protocol (MCP)** 协议，让云端的 AI 能够安全地控制你本地的工具（如读写文件、执行 Git 命令等）。

**mcp2api** acts as a bridge connecting **Web-based AI** (ChatGPT / Gemini) with your **Local Machine**. By leveraging the **Model Context Protocol (MCP)**, it allows cloud AI to safely control your local tools (e.g., file system access, git commands).

---

## 🏗 Architecture (架构)

```mermaid
graph LR
    A[Web AI (ChatGPT/Gemini)] -- 1. Generate JSON Command --> B(Browser + Tampermonkey Script);
    B -- 2. HTTP POST --> C[Local Node.js Gateway];
    C -- 3. MCP Protocol --> D[MCP Server (Filesystem/Git/etc)];
    D -- 4. Result --> C;
    C -- 5. Response --> B;
    B -- 6. Auto-Fill Input --> A;
```

---

## 🇨🇳 中文说明

### 核心组件
1.  **Node.js Gateway (`server.js`)**: 一个轻量级的 HTTP 服务器，负责接收浏览器的请求，并将其转换为 MCP 协议指令转发给本地工具。
2.  **Tampermonkey 脚本 (`YOUHOU.js`)**: 运行在浏览器端，实时监听 AI 的回答。一旦发现 `mcp_action: call` 指令，自动转发给本地网关，并将结果回填到对话框。
3.  **配置文件 (`mcp-config.json`)**: 定义了本地挂载了哪些 MCP 服务（默认为文件系统）。

### 🚀 快速开始

#### 1. 启动本地网关
确保已安装 Node.js。

```bash
# 安装依赖
npm install

# 启动服务 (默认端口 3000)
npm start
```

#### 2. 安装浏览器脚本
1.  安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展。
2.  新建一个脚本，将项目中的 `YOUHOU.js` 内容复制粘贴进去并保存。
3.  刷新 ChatGPT 或 Gemini 页面，控制台应显示 `[MCP Bridge] 🚀 v1.1 已启动!`。

#### 3. 配置 MCP 服务
编辑 `mcp-config.json` 来添加更多工具。默认配置已包含文件系统访问权限：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"]
    }
  }
}
```

### ⚠️ 安全警告
此工具赋予了 Web AI **真实的本地执行权限**（如读写文件）。请务必：
* **不要**在使用未知或不可信的 Prompt 时运行此服务。
* 在 `mcp-config.json` 中严格限制文件系统的访问路径（例如不要直接映射根目录）。

---

## 🇺🇸 English Description

### Core Components
1.  **Node.js Gateway (`server.js`)**: A lightweight HTTP server that acts as an aggregator. It translates HTTP requests from the browser into MCP protocol commands for local tools.
2.  **UserScript (`YOUHOU.js`)**: Runs in the browser (via Tampermonkey). It listens for `mcp_action: call` JSON blocks in the AI's response, forwards them to localhost, and auto-submits the result.
3.  **Config (`mcp-config.json`)**: Defines which MCP servers are active (defaults to Filesystem).

### 🚀 Quick Start

#### 1. Start Local Gateway
Ensure Node.js is installed.

```bash
# Install dependencies
npm install

# Start server (Default port 3000)
npm start
```

#### 2. Install Browser Script
1.  Install the [Tampermonkey](https://www.tampermonkey.net/) extension.
2.  Create a new script, copy the content of `YOUHOU.js` from this project, and save it.
3.  Refresh ChatGPT or Gemini. The console should log `[MCP Bridge] 🚀 v1.1 已启动!`.

#### 3. Configure MCP Servers
Edit `mcp-config.json` to mount more tools. Default configuration includes filesystem access:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"]
    }
  }
}
```

### ⚠️ Security Warning
This tool grants Web AI **real local execution permissions** (e.g., reading/writing files). Please:
* **Do not** run this service with untrusted prompts.
* Strictly limit the filesystem paths in `mcp-config.json` (avoid mapping your root directory if possible).
