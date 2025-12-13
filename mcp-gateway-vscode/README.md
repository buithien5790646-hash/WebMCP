# WebMCP Gateway (VS Code Extension)

[中文文档](README_zh.md)

> ⚠️ **IMPORTANT**
> This extension requires the companion browser extension **WebMCP Bridge** to function.
> Please ensure you have installed the corresponding extension in Chrome or Edge.

## 🚀 Introduction
**WebMCP Gateway** turns your VS Code into a local MCP (Model Context Protocol) server. This allows Web-based AI models (like Gemini, ChatGPT, DeepSeek) to securely access your local files, execute terminal commands, and assist you in writing code.

## ✨ Core Features
* **Zero-Config Connection**: Automatically finds available ports, no manual setup required.
* **Secure Bridging**: Uses a one-time Token mechanism to ensure secure communication between the browser and the editor.
* **Tool Exposure**: Standardizes local filesystem operations and terminal commands as MCP tools for the AI.

## ⚙️ Installation & Usage

1. **Install**: Search for `WebMCP Gateway` in the VS Code Marketplace and install it.
2. **Start Service**: After installation, click the `MCP Gateway: Off` button in the status bar (bottom right). When it changes to `On`, the service is running.
3. **Browser Companion**: Ensure you have the **WebMCP Bridge** extension installed in your browser.

## ❓ FAQ

**Q: Clicking the status bar does nothing?**
A: Check if any other program is using ports in the 30000-40000 range, or try restarting VS Code.

**Q: Browser extension shows "Disconnected"?**
A: Ensure VS Code is running and the status bar shows `On`. If it's the first time connecting, try refreshing the AI page.

---
## 📄 License
MIT License