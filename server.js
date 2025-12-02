import express from "express";
import cors from "cors";
import fs from "fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ================= 配置区 =================
const PORT = 3000;
const CONFIG_FILE = "./mcp-config.json";

// ================= 核心管理类 =================
class GatewayManager {
  constructor() {
    // 存储 [工具名] -> { client, definition } 的映射
    this.toolRouter = new Map();
    // 存储所有已连接的 Client
    this.connectedClients = [];
    this.config = {};
  }

  // 1. 加载配置
  loadConfig() {
    try {
      const configData = fs.readFileSync(CONFIG_FILE, "utf-8");
      this.config = JSON.parse(configData);
      console.log(`✅ Loaded configuration from ${CONFIG_FILE}.`);
    } catch (e) {
      console.error(`❌ Error reading ${CONFIG_FILE}:`, e.message);
      // 如果找不到文件，就创建一个空的默认配置
      this.config = { mcpServers: {} };
    }
  }

  // NEW: 写入配置到文件
  async saveConfig() {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), "utf-8");
      console.log(`✅ Configuration saved to ${CONFIG_FILE}.`);
    } catch (e) {
      console.error(`❌ Error writing ${CONFIG_FILE}:`, e.message);
      throw new Error("Failed to save configuration file.");
    }
  }

  // 2. 连接所有 MCP 服务 (原 bootstrap 逻辑)
  async connectAllServers() {
    // 断开所有现有连接
    this.connectedClients.forEach(c => {
        try {
            c.client.disconnect();
        } catch (e) {
            // 忽略断开连接时可能出现的错误
        }
    });
    this.toolRouter.clear();
    this.connectedClients = [];

    console.log("🔌 Connecting all MCP servers...");

    for (const [serverId, serverConfig] of Object.entries(this.config.mcpServers)) {
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
        this.connectedClients.push({ id: serverId, client, config: serverConfig });

        const list = await client.listTools();
        console.log(
          `   ✅ [${serverId}] Connected. Loaded ${list.tools.length} tools.`
        );

        // 注册路由
        list.tools.forEach((tool) => {
          if (this.toolRouter.has(tool.name)) {
            console.warn(
              `   ⚠️ Warning: Tool '${tool.name}' is defined in multiple servers! Using the one from ${serverId}.`
            );
          }
          this.toolRouter.set(tool.name, {
            client,
            definition: tool,
          });
        });
      } catch (error) {
        console.error(`   ❌ Failed to connect [${serverId}]:`, error.message);
      }
    }
    console.log(
      `✨ Gateway Ready! Managing ${this.toolRouter.size} tools across ${this.connectedClients.length} servers.\n`
    );
  }
  
  // NEW: 重新加载配置并重启所有服务
  async restartAllServers() {
      console.log("🔄 Initiating full server restart...");
      this.loadConfig(); // 重新加载最新配置
      await this.connectAllServers();
  }

  // 3. 调用工具 (原 /v1/tools/call 核心逻辑)
  async callTool(name, args) {
    // 拦截 list_tools 系统调用
    if (name === "list_tools") {
      console.log("   🔍 Intercepting system call: list_tools");

      const allTools = Array.from(this.toolRouter.values()).map(item => item.definition);
      const uniqueTools = [...new Map(allTools.map(item => [item.name, item])).values()];

      // 构造符合 MCP 结果格式的返回值
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(uniqueTools, null, 2),
          },
        ],
        isError: false,
      };
    }

    // 标准路由逻辑
    const route = this.toolRouter.get(name);
    if (!route) {
      const availableTools = Array.from(this.toolRouter.keys()).join(", ");
      throw new Error(
        `Tool '${name}' not found. Available tools: [${availableTools}, list_tools]`
      );
    }

    // 使用 SDK 调用真正的 MCP 服务
    return await route.client.callTool({
      name: name,
      arguments: args || {},
    });
  }

  // 4. 获取所有工具定义 (原 /v1/tools 核心逻辑)
  getToolDefinitions() {
    return Array.from(this.toolRouter.values()).map((item) => item.definition);
  }

  // 5. 获取连接的服务器信息 (用于配置页面)
  getServerStatuses() {
    return this.connectedClients.map(client => ({
      id: client.id,
      status: 'connected',
      config: client.config,
      toolCount: Array.from(this.toolRouter.values()).filter(item => item.client === client.client).length
    }))
  }
}

// ================= API 和启动流程 =================

const manager = new GatewayManager();

/**
 * 封装启动函数，便于 CLI 导入
 * @param {number} port 监听端口
 */
export async function startGateway(port = PORT) {
  manager.loadConfig();
  
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // 为配置页面提供静态文件服务
  app.use(express.static('public'));
  
  // 1. GET /v1/tools: 获取所有可用工具的定义
  app.get("/v1/tools", (req, res) => {
    res.json({ tools: manager.getToolDefinitions() });
  });
  
  // 2. POST /v1/tools/call: 调用工具
  app.post("/v1/tools/call", async (req, res) => {
    const { name, arguments: args } = req.body;
  
    if (!name) {
      return res.status(400).json({ error: "Missing 'name' in request body" });
    }
  
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
  
  // 3. GET /v1/config: 获取当前的配置和服务器状态
  app.get("/v1/config", (req, res) => {
      res.json({
          config: manager.config,
          servers: manager.getServerStatuses(),
      });
  });

  // 4. NEW: POST /v1/config - 保存新配置并重启服务
  app.post("/v1/config", async (req, res) => {
    try {
      const newConfig = req.body.config;
  
      if (!newConfig || !newConfig.mcpServers) {
          return res.status(400).json({ error: "Invalid configuration structure: missing mcpServers." });
      }
  
      // 更新 manager 的配置对象
      manager.config = newConfig;
  
      // 保存到磁盘
      await manager.saveConfig();
  
      // 重启服务以应用新配置
      await manager.connectAllServers();
  
      res.json({ success: true, message: "Configuration saved and servers restarted successfully." });
    } catch (error) {
      console.error('❌ Configuration Update Error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 5. NEW: POST /v1/servers/restart - 专用重启接口
  app.post("/v1/servers/restart", async (req, res) => {
      try {
          await manager.restartAllServers();
          res.json({ success: true, message: "All MCP services reloaded and restarted." });
      } catch (error) {
          console.error('❌ Server Restart Error:', error.message);
          res.status(500).json({ success: false, error: error.message });
      }
  });

  await manager.connectAllServers();

  app.listen(port, () => {
    console.log(`🌐 HTTP API listening on http://localhost:${port}`);
    console.log(`⚙️ Config UI available at http://localhost:${port}/`);
    console.log(`DOCUMENTATION:`);
    console.log(
      `  GET  http://localhost:${port}/v1/tools      -> List capability`
    );
    console.log(
      `  POST http://localhost:${port}/v1/tools/call -> Execute tool`
    );
  });
}

// 导出 PORT 和 CONFIG_FILE 以供 CLI 使用
export { PORT, CONFIG_FILE, GatewayManager };