# MCP2API Bridge (Browser Extension)

[🇨🇳 中文说明](README_zh.md)

This is a Chrome/Edge extension that bridges Web-based AI (ChatGPT/Gemini) to your local MCP Gateway, allowing the AI to access local tools securely.

## ✨ Features
- **Secure & Private**: Uses Manifest V3 architecture. Requests are proxied via a background service worker.
- **Configurable**: Change the API port or toggle "Auto-Send" logic instantly via the popup menu.
- **Visual Feedback**: Recognizes MCP JSON commands and highlights them with a green border.

## 📥 Installation

1.  Open Chrome or Edge and navigate to `chrome://extensions`.
2.  Enable **Developer mode** (toggle in the top right corner).
3.  Click **Load unpacked**.
4.  Select this `Extension` folder.

## ⚙️ Configuration

Click the extension icon in your browser toolbar to open the settings panel:
- **Gateway Port**: Default is `3000`. Change this if your local MCP gateway runs on a different port.
- **Auto Send**:
    - ✅ **On**: The extension automatically submits the tool result to the AI.
    - ❌ **Off**: The extension fills the input box but waits for you to review and press Enter.

## 🚀 Usage

1.  Ensure your local MCP Gateway is running (`npm start` in the root directory).
2.  Open ChatGPT or Google Gemini.
3.  The extension is active when you see the `[MCP Extension] ...` log in the browser console (F12).