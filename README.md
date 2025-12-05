# WebMCP 🌉

**连接网页版 AI 与本地开发环境的通用桥梁 (Zero-Config)。**

> 🛑 **告别 Copy-Paste**：不再需要在 Gemini/ChatGPT/DeepSeek 和 VS Code 之间手动复制粘贴代码。
> 🚀 **零配置体验**：无需手动填写端口，无需配置白名单，点击即用。
> 🔐 **安全无忧**：采用动态 Token 认证机制，确保只有您的 VS Code 能连接浏览器。

---

## 🌟 核心特性

- **⚡️ Zero-Config (零配置)**：VS Code 自动管理端口和认证 Token，一键握手。
- **🌍 全平台支持**：完美适配 **Gemini**、**ChatGPT**、**DeepSeek** 等主流网页版 AI。
- **🔌 协议标准化**：基于 Model Context Protocol (MCP)，支持挂载本地文件系统、Git、数据库等任意工具。
- **🛡️ 动态安全**：
  - 每次启动生成随机 **Token**，彻底告别繁琐的 Extension ID 白名单。
  - 支持 **Origin 隔离**，防止恶意网页访问本地网关。
- **🧠 智能多开**：
  - 支持同时打开多个 VS Code 窗口，每个窗口拥有独立端口和 Token。
  - 浏览器插件智能识别端口冲突，防止连接错乱。

---

## 🚀 快速开始

### 1. 安装本地网关 (VS Code)

1. 下载/调试 `mcp-gateway-vscode` 插件。
2. 启动后，状态栏会显示 `WebMCP: <Port>` (如 `34567`)。

### 2. 安装浏览器插件 (Chrome/Edge)

1. 加载 `mcp-bridge-browser` (开发者模式加载已解压的扩展)。
2. **无需任何配置**，保持启用即可。

### 3. 开始使用 (Magic happens here!)

1. 点击 VS Code 状态栏的 **WebMCP** 图标（或使用命令 `WebMCP: Connect AI`）。
2. 选择您想使用的 AI 平台（如 `Open DeepSeek`）。
3. 浏览器会自动打开一个中转页，完成 **自动握手** 后跳转到 AI 页面。
4. **尽情对话**：
   - “读取 `src/utils.ts` 帮我写个单元测试。”
   - “检查当前 Git 改动。”
   - “在 `docs` 目录下生成项目文档。”

---

## ⚙️ 高级配置

大多数情况下您**不需要**配置任何东西。但如果您有特殊需求：

### VS Code 设置 (`settings.json`)

- `mcpGateway.port`: 起始端口 (默认 `34567`)。如果被占用，会自动递增。
- `mcpGateway.browser`: 指定打开的浏览器 (Chrome/Edge/Default)。
- `mcpGateway.servers`: 配置额外的 MCP 服务器 (默认已包含 `filesystem`)。

### 浏览器插件

- 点击插件图标，您可以：
  - 查看当前连接状态。
  - 开启/关闭 **Auto Send** (结果回填后自动发送)。

---

## 🛠️ 故障排查

**Q: 点击跳转后卡在中转页 (Connecting...)？**
- 检查浏览器插件是否已安装并启用。
- 尝试在扩展管理页 **重载 (Reload)** 插件。
- 确保端口在 `34567` - `34576` 范围内 (这是 Chrome 安全策略限制的端口范围)。

**Q: 提示 "Forbidden: Invalid Security Token"？**
- 您可能直接在浏览器输入了地址，或者 Token 已过期。
- 请务必从 **VS Code 状态栏** 启动连接。

---

## 📄 License

MIT
