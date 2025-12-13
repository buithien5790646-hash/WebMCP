# WebMCP Bridge (Browser Extension)

[中文文档](README_zh.md)

> ⚠️ **IMPORTANT**
> This extension is a companion for **WebMCP Gateway**.
> You must install and start the `WebMCP Gateway` extension in VS Code before using this.

## 🚀 Introduction
**WebMCP Bridge** is the connector that links Web AI Chatbots (Gemini, ChatGPT, DeepSeek, etc.) to your local VS Code environment. It intercepts specific AI tool calls and securely forwards them to your local VS Code server, allowing the cloud AI to "see" and "operate" on your local projects.

## 🔧 Usage

1. **Preparation**: Open VS Code, ensure **WebMCP Gateway** is installed, and click the status bar to start the service.
2. **Auto Connect**: Open ChatGPT or other supported AI pages. The extension will automatically detect and connect to the local service (the icon will turn green).
3. **Send Prompt (Critical Step)**:
    * Click the extension icon in the browser toolbar.
    * Click the **Copy System Prompt** button.
    * **Paste** the content to the AI and send it.
    * *This step tells the AI which tools are available and how to call them.*
4. **Start Chatting**: Once the AI confirms, you can ask it to read files or execute commands.
5. **Troubleshooting**: If the icon is red or gray, click the icon to view detailed troubleshooting steps.

## 📥 Get VS Code Extension
Search in VS Code Marketplace: `WebMCP Gateway`

---
## 📄 License
MIT License