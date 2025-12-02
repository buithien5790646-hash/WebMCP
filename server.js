import express from "express";
import cors from "cors";
import fs from "fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ================= 配置区 =================
const PORT = 3000;
const CONFIG_FILE = "./mcp-config.json";

const app = express();
app.use(cors());
app.use(express.json());

// ================= 全局状态 =================
// 存储 [工具名] -> [Client实例] 的映射，用于路由
const toolRouter = new Map();
// 存储所有已连接的 Client，用于调试
const connectedClients = [];

// ================= 核心逻辑：启动并聚合 MCP =================
async function bootstrap() {
  console.log("🚀 Starting MCP2API Gateway...");

  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch (e) {
    console.error(`❌ Error reading ${CONFIG_FILE}:`, e.message);
    process.exit(1);
  }

  for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
    console.log(`🔌 Connecting to [${serverId}]...`);

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
      connectedClients.push({ id: serverId, client });

      // 获取该服务提供的工具列表
      const list = await client.listTools();

      console.log(
        `   ✅ [${serverId}] Connected. Loaded ${list.tools.length} tools.`
      );

      // 注册路由
      list.tools.forEach((tool) => {
        if (toolRouter.has(tool.name)) {
          console.warn(
            `   ⚠️ Warning: Tool '${tool.name}' is defined in multiple servers! Using the one from ${serverId}.`
          );
        }
        // 关键：将工具名映射到对应的 Client 实例
        toolRouter.set(tool.name, {
          client,
          definition: tool, // 保存工具定义以便 /tools 接口返回
        });
      });
    } catch (error) {
      console.error(`   ❌ Failed to connect [${serverId}]:`, error.message);
    }
  }
  console.log(
    `✨ Gateway Ready! Managing ${toolRouter.size} tools across ${connectedClients.length} servers.\n`
  );
}

// ================= API 路由定义 =================

/**
 * 1. GET /v1/tools
 * 获取所有可用工具的定义 (JSON Schema)
 */
app.get("/v1/tools", async (req, res) => {
  // 实时从 Router 中提取所有工具定义
  const tools = Array.from(toolRouter.values()).map((item) => item.definition);
  res.json({ tools });
});

/**
 * 2. POST /v1/tools/call
 * 调用工具
 * Body: { "name": "...", "arguments": { ... } }
 */
app.post("/v1/tools/call", async (req, res) => {
  const { name, arguments: args } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Missing 'name' in request body" });
  }

  console.log(`⚡ API Request: Executing tool [${name}]`);

  try {
    // =========== 🆕 新增逻辑：拦截 list_tools 系统调用 ===========
    if (name === "list_tools") {
      console.log("   🔍 Intercepting system call: list_tools");

      // 聚合所有已连接 Client 的工具列表
      const allTools = [];
      for (const item of toolRouter.values()) {
        // 为了避免重复，只提取 definition
        allTools.push(item.definition);
      }
      // 去重（虽然 Map 已经去重了 Key，但为了保险）
      const uniqueTools = [
        ...new Map(allTools.map((item) => [item.name, item])).values(),
      ];

      // 构造符合 MCP 结果格式的返回值
      return res.json({
        content: [
          {
            type: "text",
            text: JSON.stringify(uniqueTools, null, 2), // 格式化为文本给 AI 看
          },
        ],
        isError: false,
      });
    }
    // ========================================================

    // 标准路由逻辑
    const route = toolRouter.get(name);
    if (!route) {
      // 友好的错误提示，顺便告诉 AI 有哪些工具可用，引导它自我修正
      const availableTools = Array.from(toolRouter.keys()).join(", ");
      throw new Error(
        `Tool '${name}' not found. Available tools: [${availableTools}, list_tools]`
      );
    }

    // 使用 SDK 调用真正的 MCP 服务
    const result = await route.client.callTool({
      name: name,
      arguments: args || {},
    });

    res.json(result);
  } catch (error) {
    console.error(`❌ Execution Error [${name}]:`, error.message);
    res.status(500).json({
      isError: true,
      content: [{ type: "text", text: `Error: ${error.message}` }],
    });
  }
});

// ================= 启动服务 =================
bootstrap().then(() => {
  app.listen(PORT, () => {
    console.log(`🌐 HTTP API listening on http://localhost:${PORT}`);
    console.log(`DOCUMENTATION:`);
    console.log(
      `  GET  http://localhost:${PORT}/v1/tools      -> List capability`
    );
    console.log(
      `  POST http://localhost:${PORT}/v1/tools/call -> Execute tool`
    );
  });
});
