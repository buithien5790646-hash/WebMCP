import express from "express";
import cors from "cors";
import fs from "fs";
import readline from "readline";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ================= 配置区 =================
const PORT = 3000;
const CONFIG_FILE = "./mcp-config.json";
let ALLOWED_EXTENSION_ID = process.env.ALLOWED_EXTENSION_ID || "";

// ================= 核心管理类 =================
class GatewayManager {
  constructor() {
    this.toolRouter = new Map();
    this.connectedClients = [];
    this.config = {};
  }

  loadConfig() {
    try {
      const configData = fs.readFileSync(CONFIG_FILE, "utf-8");
      this.config = JSON.parse(configData);
      console.log(`✅ Loaded configuration from ${CONFIG_FILE}.`);
    } catch (e) {
      console.error(`❌ Error reading ${CONFIG_FILE}:`, e.message);
      this.config = { mcpServers: {} };
    }
  }

  async saveConfig() {
    try {
      fs.writeFileSync(
        CONFIG_FILE,
        JSON.stringify(this.config, null, 2),
        "utf-8"
      );
      console.log(`✅ Configuration saved to ${CONFIG_FILE}.`);
    } catch (e) {
      console.error(`❌ Error writing ${CONFIG_FILE}:`, e.message);
      throw new Error("Failed to save configuration file.");
    }
  }

  async connectAllServers() {
    this.connectedClients.forEach((c) => {
      try {
        c.client.disconnect();
      } catch (e) {}
    });
    this.toolRouter.clear();
    this.connectedClients = [];

    console.log("🔌 Connecting all MCP servers...");

    for (const [serverId, serverConfig] of Object.entries(
      this.config.mcpServers || {}
    )) {
      console.log(`   -> [${serverId}]...`);
      try {
        const transport = new StdioClientTransport({
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: { ...process.env, ...(serverConfig.env || {}) },
        });

        const client = new Client(
          { name: "mcp2api-gateway", version: "1.0.0" },
          { capabilities: {} }
        );

        await client.connect(transport);
        this.connectedClients.push({
          id: serverId,
          client,
          config: serverConfig,
        });

        const list = await client.listTools();
        console.log(
          `   ✅ [${serverId}] Connected. Loaded ${list.tools.length} tools.`
        );

        list.tools.forEach((tool) => {
          if (this.toolRouter.has(tool.name)) {
            console.warn(
              `   ⚠️ Warning: Tool '${tool.name}' is defined in multiple servers! Using the one from ${serverId}.`
            );
          }
          this.toolRouter.set(tool.name, { client, definition: tool });
        });
      } catch (error) {
        console.error(`   ❌ Failed to connect [${serverId}]:`, error.message);
      }
    }
    console.log(
      `✨ Gateway Ready! Managing ${this.toolRouter.size} tools across ${this.connectedClients.length} servers.\n`
    );
  }

  async restartAllServers() {
    console.log("🔄 Initiating full server restart...");
    this.loadConfig();
    await this.connectAllServers();
  }

  async callTool(name, args) {
    if (name === "list_tools") {
      console.log("   🔍 Intercepting system call: list_tools");
      const allTools = Array.from(this.toolRouter.values()).map(
        (item) => item.definition
      );
      const uniqueTools = [
        ...new Map(allTools.map((item) => [item.name, item])).values(),
      ];
      return {
        content: [{ type: "text", text: JSON.stringify(uniqueTools, null, 2) }],
        isError: false,
      };
    }

    const route = this.toolRouter.get(name);
    if (!route) {
      const availableTools = Array.from(this.toolRouter.keys()).join(", ");
      throw new Error(
        `Tool '${name}' not found. Available tools: [${availableTools}, list_tools]`
      );
    }

    return await route.client.callTool({ name, arguments: args || {} });
  }

  getToolDefinitions() {
    return Array.from(this.toolRouter.values()).map((item) => item.definition);
  }

  getServerStatuses() {
    return this.connectedClients.map((client) => ({
      id: client.id,
      status: "connected",
      config: client.config,
      toolCount: Array.from(this.toolRouter.values()).filter(
        (item) => item.client === client.client
      ).length,
    }));
  }
}

// ================= 辅助函数：获取 Extension ID =================
async function ensureExtensionId() {
  if (ALLOWED_EXTENSION_ID) return;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log(
      "\n🔒 Security Check: No Extension ID found in environment variables."
    );
    console.log(
      "   Please enter the ID of your Chrome Extension to whitelist it."
    );
    console.log("   (You can copy it from the extension popup window)");
    rl.question("👉 Extension ID: ", (answer) => {
      ALLOWED_EXTENSION_ID = answer.trim();
      console.log(`✅ Whitelisted Extension ID: ${ALLOWED_EXTENSION_ID}\n`);
      rl.close();
      resolve();
    });
  });
}

// ================= API 和启动流程 =================
const manager = new GatewayManager();

export async function startGateway(port = PORT) {
  await ensureExtensionId();
  manager.loadConfig();

  const app = express();

  // 1. 安全中间件：日志 + Origin 检查 (支持插件和本地UI)
  app.use((req, res, next) => {
    const d = new Date();
    const timestamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(
      2,
      "0"
    )}:${String(d.getMinutes()).padStart(2, "0")}:${String(
      d.getSeconds()
    ).padStart(2, "0")}`;
    const origin = req.get("origin");

    // 允许：空Origin(脚本), 插件ID, localhost, 127.0.0.1
    const isAllowed =
      !origin ||
      origin === `chrome-extension://${ALLOWED_EXTENSION_ID}` ||
      origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1");

    console.log(`\n[${timestamp}] 🔔 Request: ${req.method} ${req.url}`);
    console.log(`   - IP: ${req.ip}`);
    console.log(
      `   - Origin: ${origin || "(None/Script)"} ${
        isAllowed ? "✅ Allowed" : "❌ BLOCKED"
      }`
    );

    if (!isAllowed) {
      console.warn(`   ⛔ Blocked request from unauthorized origin: ${origin}`);
      return res.status(403).json({ error: "Forbidden: Unauthorized Origin" });
    }
    next();
  });

  // 2. CORS 配置：允许白名单 ID 和本地开发地址
  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          origin === `chrome-extension://${ALLOWED_EXTENSION_ID}` ||
          origin.startsWith("http://localhost") ||
          origin.startsWith("http://127.0.0.1")
        ) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
    })
  );

  app.use(express.json());
  app.use(express.static("public"));

  app.get("/v1/tools", (req, res) => {
    res.json({ tools: manager.getToolDefinitions() });
  });

  app.post("/v1/tools/call", async (req, res) => {
    const { name, arguments: args } = req.body;
    if (!name) return res.status(400).json({ error: "Missing 'name'" });

    console.log(`⚡ API Request: Executing tool [${name}]`);
    try {
      const result = await manager.callTool(name, args);
      res.json(result);
    } catch (error) {
      console.error(`❌ Execution Error [${name}]:`, error.message);
      res.status(500).json({
        isError: true,
        content: [{ type: "text", text: `Error: ${error.message}` }],
      });
    }
  });

  app.get("/v1/config", (req, res) =>
    res.json({ config: manager.config, servers: manager.getServerStatuses() })
  );

  app.post("/v1/config", async (req, res) => {
    try {
      manager.config = req.body.config;
      await manager.saveConfig();
      await manager.connectAllServers();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/v1/servers/restart", async (req, res) => {
    try {
      await manager.restartAllServers();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  await manager.connectAllServers();

  // 🔒 只监听本地回环地址 127.0.0.1
  app.listen(port, "127.0.0.1", () => {
    console.log(`\n🌐 Secure Gateway listening on http://127.0.0.1:${port}`);
    console.log(`🛡️  Allowed Extension ID: ${ALLOWED_EXTENSION_ID}`);
    console.log(`⚙️  Config UI available at: http://localhost:${port}`);
  });
}

export { PORT, CONFIG_FILE, GatewayManager };
