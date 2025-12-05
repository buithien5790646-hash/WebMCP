# WebMCP 🌉

**Universal Bridge connecting Web AI to Local Development Environments (Zero-Config).**

[中文文档](README_zh.md)

> 🛑 **No More Copy-Paste**: Stop manually copying code between DeepSeek/ChatGPT/Gemini and VS Code.
> 🚀 **Zero-Config**: No manual port entry, no whitelist configuration, just click and use.
> 🔐 **Secure**: Uses dynamic Token authentication to ensure only your VS Code can connect.

---

## 🌟 Core Features

- **⚡️ Zero-Config**: VS Code manages ports and tokens automatically, one-click handshake.
- **🌍 Cross-Platform**: Fully supports **DeepSeek**, **ChatGPT**, **Gemini**, and other web-based AIs.
- **🔌 Standardized**: Based on [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), supports mounting local filesystems, Git, and other tools.
- **🛡️ Dynamic Security**:
  - Random **Token** generated per session, eliminating the need for fixed Extension ID whitelists.
  - Supports **Origin Isolation** to prevent malicious pages from accessing the local gateway.
- **🧠 Smart Routing**:
  - Automatically selects the browser based on the URL (e.g., DeepSeek -> Edge, ChatGPT -> Chrome).
  - Supports multiple VS Code windows and multiple concurrent connections.

---

## 📖 Usage Guide

### 1. Installation
- **VS Code**: Search for `WebMCP Gateway` in the Extension Marketplace and install.
- **Browser**: Search for `WebMCP Bridge` in the Chrome/Edge Web Store and install.

### 2. Connect
1. Open VS Code. The status bar at the bottom right will show `WebMCP: <Port>` (e.g., `34567`), indicating the service is ready.
2. Click the status bar icon and select the AI platform you want to use (e.g., `Open DeepSeek`).
3. The browser will open a bridge page, perform an **Automatic Handshake**, and then redirect to the AI page.
4. **Connected!** The browser extension icon will turn green (`ON`).

### 3. Initialize AI (Important)
Before starting the conversation, you must let the AI know how to use the local tools:
1. Click the **WebMCP Bridge** extension icon in the browser toolbar.
2. Click the **Copy System Prompt** button in the popup.
3. **Paste** the content to the AI and send it.
4. Once the AI confirms it has received the tool definitions, initialization is complete.

### 4. Start Chatting
Now you can ask the Web AI to operate on your local project:
- "Read `src/utils.ts` and write a unit test for it."
- "Check the file structure of the current directory."
- "Generate project documentation in the `docs` folder."

> **Tips**:
> - Click the status bar and select `Custom Launch...` to manually choose which browser to open.
> - Search for `Browser Rules` in VS Code Settings to configure default "Domain-Browser" mapping rules.

---

## 🛠️ Developer Guide (Build from Source)

If you want to compile or contribute, follow these steps:

### Requirements
- Node.js (v18+)
- VS Code

### 1. Get Source
```bash
git clone [https://github.com/three-water666/WebMCP.git](https://github.com/three-water666/WebMCP.git)
cd WebMCP
```

### 2. Build
The project includes a cross-platform build script to generate both the VS Code extension (`.vsix`) and the Browser extension (`.zip`).

**Mac / Linux:**
```bash
chmod +x build_release.sh
./build_release.sh
```

**Windows (PowerShell):**
```powershell
.\build_release.ps1
```

The artifacts will be in the `release/` folder.

### 3. Install & Debug
- **VS Code**: Sidebar -> `...` -> `Install from VSIX...` -> Select the `.vsix` file.
- **Browser**: Extensions page -> Enable "Developer mode" -> "Load unpacked" -> Select the unzipped folder in `release/` (or the `mcp-bridge-browser` source folder).

---

## 🤝 Contributing

Contributions are welcome! Whether it's reporting bugs or submitting Pull Requests, we appreciate your help.

---

## 📄 License

[MIT License](LICENSE)