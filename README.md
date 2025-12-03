# MCP Bridge

**让网页版 AI 真正连接你的本地代码库。**

**MCP Bridge** 是一个全栈解决方案，通过 Model Context Protocol (MCP) 协议，让网页端的 AI（ChatGPT, Gemini, DeepSeek）能够安全地操作你本地 VS Code 中的文件、Git 和命令行工具。

## 🌟 项目架构

**MCP Bridge** 由两个核心组件构成：

1.  **Gateway (VS Code 插件)**: 本地网关。作为服务端运行在 VS Code 中，管理本地工具权限。
2.  **Client (浏览器插件)**: 客户端桥梁。拦截网页 AI 的请求并转发给本地网关。

---

## 🚀 快速开始

### 第一步：安装 Gateway (VS Code)

1.  进入 `mcp-gateway-vscode/` 目录并打包：
    ```bash
    cd mcp-gateway-vscode
    npm install -g @vscode/vsce
    vsce package
    ```
2.  在 VS Code 中：**扩展** -> **...** -> **从 VSIX 安装** -> 选择生成的文件。
3.  **安装即用**：插件会自动在端口 `34567` 启动服务。

### 第二步：安装 Client (浏览器)

1.  浏览器访问 `chrome://extensions` -> 开启 **开发者模式**。
2.  点击 **加载已解压的扩展程序** -> 选择 `mcp-bridge-browser/` 目录。
3.  默认已配置好连接本地 `34567` 端口。

### 第三步：配对认证

1.  打开浏览器插件弹窗 -> 点击 **Copy** 复制 Extension ID。
2.  打开 VS Code 设置 (`Ctrl+,`) -> 搜索 `mcp-gateway` -> 粘贴到 **Allowed Extension Id** 中。

---

## 💡 使用方法

1.  打开 **ChatGPT / Gemini / DeepSeek**。
2.  点击 **MCP Bridge** 插件图标 -> **Copy System Prompt** (复制提示词)。
3.  发送给 AI，激活它的“本地操作”能力。
4.  **开始指令**：
    * “帮我读取 `README.md` 并翻译成英文。”
    * “检查 Git 状态并提交代码。”

---

## 🛠️ 依赖说明

* **Node.js**: 必须安装 (用于支持文件系统操作)。
* **Python**: 可选安装 (若需要 Git/Fetch 功能，请运行 `pip install mcp-server-git mcp-server-fetch`)。
