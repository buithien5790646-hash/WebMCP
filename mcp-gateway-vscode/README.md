# MCP Gateway for VS Code

This extension acts as a **Model Context Protocol (MCP) Gateway**, allowing web-based AI agents (via Chrome Extension) to securely interact with your local VS Code environment.

## ✨ Features

- **Zero Config Start**: Comes with Filesystem, Git, and Fetch support out of the box.
- **Smart Context**: Automatically resolves `.` to your active workspace root.
- **Lightweight**: Uses your local `npx` and `python` to run servers, keeping the extension size minimal.

## 🚀 Getting Started

1. **Install the Extension** (`.vsix`).
2. **Set your Extension ID** in VS Code Settings:
   - `mcpGateway.allowedExtensionId`: Your Chrome Extension ID.
3. **Install Dependencies** (for Git/Fetch support):
   ```bash
   pip install mcp-server-git mcp-server-fetch
   ```
   *(Note: Node.js is required for the Filesystem server)*

## ⚙️ Configuration (Optional)

The extension works by default with the following servers:
- **Filesystem**: `npx -y @modelcontextprotocol/server-filesystem .`
- **Git**: `python -m mcp_server_git --repository .`
- **Fetch**: `python -m mcp_server_fetch`

You can customize these in `mcpGateway.servers` if needed.