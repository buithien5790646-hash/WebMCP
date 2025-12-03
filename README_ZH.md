# MCP2API Bridge

**通过 Model Context Protocol (MCP) 将基于 Web 的 AI (ChatGPT, Gemini, DeepSeek) 连接到您的本地计算机。**

本项目作为一个安全的桥梁，允许先进的 Web 端大模型通过本地网关和浏览器插件，直接与您的本地文件、数据库和工具进行交互。

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)

## ✨ 核心特性

* **🔗 无缝桥接**: 将云端 AI 网页版界面直接连接到本地 MCP 服务。
* **🛡️ 企业级安全**:
    * **来源白名单**: 严格限制访问权限，仅允许特定的 Chrome 扩展 ID 访问。
    * **本地绑定**: 网关仅监听 `127.0.0.1`，防止网络暴露。
* **👀 可视化调试**: 浏览器内置 **悬浮日志控制台 (Floating Log)**，实时监控工具执行情况。
* **🧩 配置即代码**: 系统提示词和错误提示与代码解耦，独立存放在 Markdown 文件中 (`prompt.md`, `error_hint.md`)，便于编辑。
* **🤖 多平台支持**: 开箱即用，支持：
    * ChatGPT
    * Google Gemini
    * DeepSeek Chat
* **🧠 智能上下文**: 自动将工具执行结果追加到聊天输入框，不会覆盖您已有的草稿。

## 🚀 快速开始

### 前提条件
* Node.js (v18+)
* Google Chrome (或 Chromium 内核浏览器)
* Python (可选，用于某些 MCP 服务，如 Git)

### 1. 安装

克隆仓库并安装依赖：

```bash
git clone git@github.com:three-water666/MCP2API.git
cd mcp2api
npm install
```

### 2. 配置 MCP 服务

编辑 `mcp-config.json` 以定义您希望暴露的工具。默认情况下，它包含文件系统和内存服务。请确保路径正确 (例如，将 Git 仓库路径设置为 `.`):

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"]
    },
    "git": {
      "command": "python",
      "args": ["-m", "mcp_server_git", "--repository", "."]
    }
  }
}
```

### 3. 启动网关

运行本地服务。首次运行时，它会询问您的 **Extension ID** (扩展 ID) (请参阅下一步)。

```bash
npm run dev
# 或
node server.js
```

### 4. 安装并配置插件

1.  打开 Chrome 并访问 `chrome://extensions/`。
2.  开启右上角的 **开发者模式 (Developer mode)**。
3.  点击 **加载已解压的扩展程序 (Load unpacked)** 并选择本项目中的 `Extension` 文件夹。
4.  **复制扩展 ID**:
    * 点击浏览器工具栏中的插件图标。
    * 点击 ID 字段旁边的 "Copy" 按钮。
5.  **配置白名单**:
    * 将此 ID 粘贴到您正在运行的终端窗口中 (即 `node server.js` 等待输入的地方)。
    * 服务器现在将安全地仅接受来自此扩展的请求。

## 📖 使用指南

1.  **激活 AI**: 打开 ChatGPT, Gemini 或 DeepSeek 网页。
2.  **注入系统提示词**: 
    * 打开插件弹窗。
    * 点击 **"Copy System Prompt"** 按钮。
    * 将其粘贴到聊天框中，教会 AI 如何使用您的工具。
3.  **监控执行**:
    * 在插件弹窗中开启 **"Show Floating Log"** 开关。
    * 在页面悬浮窗中观察实时日志 (工具调用、API 响应)。

## 🛠️ 自定义设置

* **系统提示词**: 编辑 `Extension/prompt.md` 以更改 AI 的行为指令。
* **错误消息**: 编辑 `Extension/error_hint.md` 以自定义失败响应。
* **注意**: 编辑这些文件后，请务必在 `chrome://extensions/` 页面点击 **刷新 (Reload)** 按钮以应用更改。

## 🔒 安全提示

此工具赋予 AI 模型对您本地文件的 **读/写权限** (取决于您的 `mcp-config.json` 配置)。
* **务必** 在悬浮日志中检查工具调用。
* **切勿** 将网关端口暴露给公网。

## 📄 许可证

MIT License