# MCP2API Bridge

**Connect Web-based AI (ChatGPT, Gemini, DeepSeek) to your Local Machine via the Model Context Protocol (MCP).**

This project serves as a secure bridge, allowing advanced web LLMs to interact with your local files, databases, and tools through a local gateway and a browser extension.

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)

## ✨ Key Features

* **🔗 Seamless Bridge**: Connects cloud AI web interfaces directly to local MCP servers.
* **🛡️ Enterprise-Grade Security**:
    * **Origin Whitelisting**: Strictly restricts access to your specific Chrome Extension ID.
    * **Local Binding**: Gateway listens only on `127.0.0.1` to prevent network exposure.
* **👀 Observable Debugging**: Built-in **Floating Log Console** in the browser to monitor tool execution in real-time.
* **🧩 Configuration as Code**: System prompts and error hints are decoupled into Markdown files (`prompt.md`, `error_hint.md`) for easy editing.
* **🤖 Multi-Platform Support**: Works out-of-the-box with:
    * ChatGPT
    * Google Gemini
    * DeepSeek Chat
* **🧠 Smart Context**: Automatically appends tool results to the chat input without overwriting your existing draft.

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* Google Chrome (or Chromium-based browser)
* Python (optional, for certain MCP servers like Git)

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone git@github.com:three-water666/MCP2API.git
cd mcp2api
npm install
```

### 2. Configure MCP Servers

Edit `mcp-config.json` to define the tools you want to expose. By default, it includes filesystem and memory servers. Ensure paths are correct (e.g., set Git repository path to `.`):

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

### 3. Start the Gateway

Run the local server. On the first run, it will ask for your **Extension ID** (see next step).

```bash
npm run dev
# or
node server.js
```

### 4. Install & Configure Extension

1.  Open Chrome and navigate to `chrome://extensions/`.
2.  Enable **Developer mode** (top right).
3.  Click **Load unpacked** and select the `Extension` folder from this project.
4.  **Copy the Extension ID**:
    * Click the extension icon in the browser toolbar.
    * Click the "Copy" button next to the ID field.
5.  **Whitelist the ID**:
    * Paste this ID into your running terminal window (where `node server.js` is waiting).
    * The server will now securely accept requests only from this extension.

## 📖 Usage Guide

1.  **Activate the AI**: Open ChatGPT, Gemini, or DeepSeek.
2.  **Inject System Prompt**: 
    * Open the extension popup.
    * Click **"Copy System Prompt"**.
    * Paste it into the chat to teach the AI how to use your tools.
3.  **Monitor Execution**:
    * Toggle **"Show Floating Log"** in the extension popup.
    * Watch real-time logs (tool calls, API responses) in the overlay window.

## 🛠️ Customization

* **System Prompt**: Edit `Extension/prompt.md` to change how the AI behaves.
* **Error Messages**: Edit `Extension/error_hint.md` to customize failure responses.
* **Note**: After editing these files, click the **Reload** button on the `chrome://extensions/` page to apply changes.

## 🔒 Security Note

This tool grants an AI model **read/write access** to your local files (depending on your `mcp-config.json`).
* **Always** review the tool calls in the Floating Log.
* **Never** expose the gateway port to the public internet.

## 📄 License

MIT License