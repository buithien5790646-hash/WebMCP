# WebMCP 🌉

**连接网页版 AI 与本地开发环境的通用桥梁。**

> 🛑 **告别 Copy-Paste**：不再需要在 Gemini/ChatGPT/DeepSeek 和 VS Code 之间手动复制粘贴代码。
> 🚀 **拥抱 MCP 生态**：利用 Model Context Protocol (MCP) 协议，让网页 AI 直接调用本地工具（文件系统、Git、数据库等）。

---

## 🌟 核心痛点与解决方案

网页版 AI 它们被困在浏览器里，无法触碰你的本地代码。**WebMCP** 打通了这“最后的一公里”：

1.  **协议标准化**：通过预设的 System Prompt，让网页 AI 学会生成标准的 JSON 指令。
2.  **浏览器拦截**：浏览器插件捕获这些指令，转发给本地。
3.  **本地执行 (VS Code)**：VS Code 插件作为网关，将指令分发给标准 **MCP Servers** 或内置工具。
4.  **闭环反馈**：执行结果自动回填到网页输入框，AI 根据结果继续思考或修正。

## ✨ 核心特性

* **🌍 全平台支持**：完美适配 **Gemini**、**ChatGPT**、**DeepSeek** 等主流网页版 AI。
* **🔌 MCP 协议原生支持**：不只是读写文件！你可以挂载任何标准的 MCP Server（如 Git, Postgres, Fetch 等），能力无限扩展。
* **🛡️ 安全可控**：支持 Extension ID 白名单机制，确保只有你自己的浏览器插件能连接。
* **🧠 智能连接管理 (New!)**：
    * **浏览器端**：支持多标签页隔离 (Tab Isolation)，每个对话窗口可配置不同端口，互不干扰。
    * **VS Code 端**：支持多实例运行，端口自动递增，且具有**端口粘性 (Stickiness)**——重启后自动记忆上次使用的端口，无需重复配置。
* **⚡ 极速交互**：优化的前端重试机制，确保在网络波动或 UI 延迟时也能稳定回填消息。

---

## 🏗️ 架构说明

```mermaid
graph LR
    A[网页 AI (Gemini/ChatGPT/DeepSeek)] -->|生成 JSON| B(浏览器插件 Client)
    B -->|HTTP 请求| C{VS Code 网关}
    C -->|MCP 协议| D[MCP Server: Filesystem]
    C -->|MCP 协议| E[MCP Server: Git]
    C -->|MCP 协议| F[更多工具...]
    D & E & F -->|返回结果| C --> B -->|自动回填| A
```

---

## 🚀 快速开始

### 1. 安装 VS Code 网关 (Server)

这是本地服务端，负责接收请求并调度工具。

1.  下载或编译 `mcp-gateway-vscode` 插件。
2.  安装到 VS Code。
3.  **配置白名单** ：
    在 VS Code 设置中搜索 `mcpGateway`，在 `Allowed Extension Ids` 中添加浏览器插件的 ID。
4.  插件启动后，状态栏会显示当前监听端口 (默认为 `34567`)。

### 2. 安装浏览器插件 (Client)

这是客户端，负责“监听” AI 的指令。

1.  加载 `mcp-bridge-browser` (开发者模式加载已解压的扩展)。
2.  打开任意支持的 AI 网页 (如 Gemini)。
3.  点击插件图标，**设置端口** (需与 VS Code 状态栏显示的一致)。
4.  点击 **"Copy System Prompt"** 复制系统提示词。

### 3. 开始使用

1.  将复制的 Prompt 发送给 AI。
2.  AI 会回复：“已准备就绪，请先执行 list_tools...”。
3.  **尽情对话**：
    * “帮我读取 `src/index.js` 并优化代码。”
    * “检查当前 Git 状态。”
    * “在 `dist` 目录下创建一个新文件。”

---

## ⚙️ 高级配置

### VS Code 设置

* `mcpGateway.port`: 初始默认端口 (默认 34567)。
* `mcpGateway.allowedExtensionIds`: (数组) 允许连接的浏览器插件 ID 列表。
* `mcpGateway.servers`: 配置要加载的 MCP 服务器。
    * 默认已内置 `filesystem` 服务器。
    * 你可以添加更多，例如 `git`:
        ```json
        "git": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-git", "."]
        }
        ```

### 浏览器插件设置

* **Port**: 当前标签页连接的本地端口 (支持多标签页不同配置)。
* **Auto Send**: 结果回填后是否自动点击发送 (推荐开启)。
* **Floating Log**: 开启悬浮日志窗口，实时查看通信状态。

---

## 🤝 贡献

欢迎提交 Issue 或 PR！
这是一个基于 MCP 协议的实验性项目，旨在探索 AI 辅助编程的新形态。

## 📄 License

MIT