# WebMCP 🌉

**连接网页版 AI 与本地开发环境的通用桥梁 (Zero-Config)。**

> 🛑 **告别 Copy-Paste**：不再需要在 DeepSeek/ChatGPT/Gemini 和 VS Code 之间手动复制粘贴代码。
> 🚀 **零配置体验**：无需手动填写端口，无需配置白名单，点击即用。
> 🔐 **安全无忧**：采用动态 Token 认证机制，确保只有您的 VS Code 能连接浏览器。

---

## 🌟 核心特性

- **⚡️ Zero-Config (零配置)**：VS Code 自动管理端口和认证 Token，一键握手连接。
- **🌍 全平台支持**：完美适配 **DeepSeek**、**ChatGPT**、**Gemini** 等主流网页版 AI。
- **🔌 协议标准化**：基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)，支持挂载本地文件系统、Git 等任意工具。
- **🛡️ 动态安全**：
  - 每次启动生成随机 **Token**，彻底告别繁琐的 Extension ID 白名单。
  - 支持 **Origin 隔离**，防止恶意网页访问本地网关。
- **🧠 智能路由**：
  - 支持根据 URL 自动选择浏览器 (如 DeepSeek -> Edge, ChatGPT -> Chrome)。
  - 支持同时打开多个 VS Code 窗口，多路连接互不干扰。

---

## 📖 使用指南 (商店用户)

如果您直接从应用市场安装，请遵循以下步骤：

### 1. 安装插件
- **VS Code**: 在扩展市场搜索 `WebMCP Gateway` 并安装。
- **浏览器**: 在 Chrome/Edge 扩展商店搜索 `WebMCP Bridge` 并安装。

### 2. 启动连接
1. 打开 VS Code，状态栏右下角会出现 `WebMCP: <Port>` (如 `34567`)，表示服务已就绪。
2. 点击状态栏图标，选择您想使用的 AI 平台（例如 `Open DeepSeek`）。
3. 浏览器会自动打开一个中转页，进行 **自动握手**，随后跳转到 AI 页面。
4. **连接成功！** 浏览器插件图标将变为绿色 `ON` 状态。

### 3. 初始化 AI (重要)
在开始对话前，必须让 AI 知道如何调用本地工具：
1. 点击浏览器右上角的 **WebMCP Bridge** 插件图标。
2. 点击弹窗中的 **Copy System Prompt** 按钮（复制系统提示词）。
3. 将内容 **粘贴** 给 AI 并发送。
4. 当 AI 回复确认收到工具定义后，初始化完成。

### 4. 开始对话
现在您可以直接在网页 AI 中操作本地项目了：
- “读取 `src/utils.ts` 并帮我写个单元测试。”
- “检查当前目录下的文件结构。”
- “在 `docs` 目录下生成项目文档。”

> **小贴士**：
> - 点击状态栏选择 `Custom Launch...` 可以临时手动选择用哪个浏览器打开。
> - 在 VS Code 设置中搜索 `Browser Rules` 可配置默认的“域名-浏览器”映射规则。

---

## 🛠️ 开发者指南 (源码编译)

如果您想自己编译或贡献代码，请按以下步骤操作：

### 环境要求
- Node.js (v18+)
- VS Code

### 1. 获取源码
```bash
git clone [https://github.com/three-water666/WebMCP.git](https://github.com/three-water666/WebMCP.git)
cd WebMCP
```

### 2. 一键构建
项目内置了跨平台构建脚本，可同时生成 VS Code 插件 (`.vsix`) 和浏览器插件 (`.zip`)。

**Mac / Linux:**
```bash
chmod +x build_release.sh
./build_release.sh
```

**Windows (PowerShell):**
```powershell
.\build_release.ps1
```

构建产物将位于根目录的 `release/` 文件夹中。

### 3. 安装调试
- **VS Code 插件**: 在 VS Code 侧边栏 -> `...` -> `Install from VSIX...` 选择生成的 `.vsix` 文件。
- **浏览器插件**: 打开浏览器扩展管理页 -> 开启“开发者模式” -> 点击“加载已解压的扩展程序” -> 选择 `release/` 下解压后的文件夹 (或直接加载源码目录 `mcp-bridge-browser`)。

---

## 🤝 贡献与反馈

非常欢迎您的贡献！无论是提交 Issue 反馈 Bug，还是提交 Pull Request 改进代码，我们都非常感谢。

- **提交 Issue**: 请详细描述您遇到的问题或建议。
- **提交 PR**: 请确保代码风格一致，并通过了基本的测试。

---

## 📄 协议

本项目采用 [MIT 协议](LICENSE) 开源。