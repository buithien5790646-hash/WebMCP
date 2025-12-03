import express from 'express';
import cors from 'cors';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// 定义服务器配置接口
interface ServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
}

interface Config {
    port: number;
    allowedExtensionId: string;
    mcpServers: Record<string, ServerConfig>;
}

export class GatewayManager {
    private app: express.Express | null = null;
    private server: any = null;
    private toolRouter = new Map<string, { client: Client; definition: any }>();
    private connectedClients: { id: string; client: Client }[] = [];
    private outputChannel: vscode.OutputChannel;
    private extensionPath: string;

    constructor(outputChannel: vscode.OutputChannel, extensionPath: string) {
        this.outputChannel = outputChannel;
        this.extensionPath = extensionPath;
    }

    private log(message: string) {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        this.outputChannel.appendLine(`[${time}] ${message}`);
    }

    private error(message: string, err?: any) {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        this.outputChannel.appendLine(`[${time}] ❌ ${message} ${err ? (err.message || JSON.stringify(err)) : ''}`);
    }

    // 获取内置 Filesystem Server 的路径
    private getInternalFsServerPath(): string {
        const fsServerPath = path.join(
            this.extensionPath,
            'node_modules',
            '@modelcontextprotocol',
            'server-filesystem',
            'dist',
            'index.js'
        );

        if (fs.existsSync(fsServerPath)) {
            return fsServerPath;
        }

        this.error(`Internal server file not found at: ${fsServerPath}`);
        return '';
    }

    async connectToServers(servers: Record<string, ServerConfig>) {
        this.connectedClients.forEach(c => { try { c.client.disconnect(); } catch (e) {} });
        this.connectedClients = [];
        this.toolRouter.clear();

        this.log('🔌 Connecting to MCP servers...');

        for (const [serverId, config] of Object.entries(servers)) {
            try {
                let command = config.command;
                let args = [...config.args];
                const env = { ...process.env, ...config.env };

                // === FIX: Windows Compatibility ===
                if (process.platform === 'win32') {
                    if (command === 'npx' || command === 'npm') {
                        command = `${command}.cmd`;
                    }
                }

                // === Logic: Built-in Filesystem Server ===
                if (command === 'node' && args[0] === 'INTERNAL_FS_SERVER') {
                    const scriptPath = this.getInternalFsServerPath();
                    if (!scriptPath) continue;
                    args[0] = scriptPath;
                    if (args[1] === '.' && vscode.workspace.workspaceFolders?.[0]) {
                        args[1] = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        this.log(`   -> [${serverId}] Using workspace root: ${args[1]}`);
                    }
                }

                this.log(`   -> Starting [${serverId}]: ${command} ${args.join(' ')}`);

                const transport = new StdioClientTransport({
                    command, args, env
                });

                const client = new Client(
                    { name: "mcp-gateway-vscode", version: "1.0.0" },
                    { capabilities: {} }
                );

                await client.connect(transport);
                this.connectedClients.push({ id: serverId, client });

                const list = await client.listTools();
                this.log(`   ✅ [${serverId}] Connected. Loaded ${list.tools.length} tools.`);

                list.tools.forEach((tool) => {
                    if (this.toolRouter.has(tool.name)) {
                        this.log(`   ⚠️ Warning: Tool '${tool.name}' overridden by ${serverId}.`);
                    }
                    this.toolRouter.set(tool.name, { client, definition: tool });
                });

            } catch (err) {
                this.error(`Failed to connect to [${serverId}]`, err);
            }
        }
    }

    async start(config: Config) {
        if (this.server) await this.stop();
        await this.connectToServers(config.mcpServers);

        this.app = express();
        this.app.use(express.json());

        // === 1. Middleware: 记录请求入口 (The "Bell") ===
        this.app.use((req, res, next) => {
            const start = Date.now();
            const origin = req.get('origin') || 'Unknown';
            
            // 🔔 Step 1: 收到请求立刻记录
            if (req.method !== 'OPTIONS') {
                this.log(`🔔 [${req.method}] ${req.url} <== ${origin}`);
            }

            // 🏁 Step 4: 响应结束时记录状态 (作为 Footer)
            res.on('finish', () => {
                const duration = Date.now() - start;
                const status = res.statusCode;
                if (req.method !== 'OPTIONS') {
                    // 只有出错或者状态码非200时用醒目图标，否则用棋盘旗表示结束
                    const icon = status >= 400 ? '❌' : '   🏁'; 
                    this.log(`${icon} Status: ${status} (${duration}ms)`);
                }
            });
            next();
        });

        // === 2. Security Middleware ===
        this.app.use((req, res, next) => {
            const origin = req.get('origin');
            const isAllowed = 
                !origin || 
                origin === `chrome-extension://${config.allowedExtensionId}` || 
                origin.startsWith('http://localhost') ||
                origin.startsWith('http://127.0.0.1');
            
            if (!isAllowed) {
                this.log(`⛔ Blocked request from unauthorized origin: ${origin}`);
                return res.status(403).json({ error: "Forbidden" });
            }
            next();
        });

        // === 3. CORS ===
        this.app.use(cors({
            origin: (origin, callback) => {
                if (!origin || 
                    origin === `chrome-extension://${config.allowedExtensionId}` || 
                    origin.startsWith('http://localhost') ||
                    origin.startsWith('http://127.0.0.1')) {
                    callback(null, true);
                } else {
                    callback(new Error("Not allowed by CORS"));
                }
            }
        }));

        // === 4. Routes ===
        this.app.get('/v1/tools', (req, res) => {
            const tools = Array.from(this.toolRouter.values()).map(t => t.definition);
            this.log(`   🚀 Executing: GET /v1/tools (Discovery)`);
            this.log(`   ✅ Returned ${tools.length} tools`);
            res.json({ tools });
        });

        this.app.post('/v1/tools/call', async (req, res) => {
            let { name, arguments: args } = req.body;
            const toolStart = Date.now();

            // === Logic: Smart Path Rewriting ===
            if (args && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
                const fixPath = (p: string) => {
                    if (typeof p === 'string' && !path.isAbsolute(p)) return path.join(root, p);
                    return p;
                };

                if (args.path) args.path = fixPath(args.path);
                if (args.source) args.source = fixPath(args.source);
                if (args.destination) args.destination = fixPath(args.destination);
                if (Array.isArray(args.paths)) args.paths = args.paths.map((p: any) => fixPath(p));
            }

            // Special case for list_tools interception
            if (name === 'list_tools') {
                const tools = Array.from(this.toolRouter.values()).map(t => t.definition);
                const uniqueTools = [...new Map(tools.map(item => [item.name, item])).values()];
                
                // 🚀 Step 2 & 3 for list_tools
                this.log(`   🚀 Executing: list_tools (Internal)`);
                this.log(`   ✅ Finished: list_tools (0ms)`);
                
                return res.json({
                     content: [{ type: 'text', text: JSON.stringify(uniqueTools, null, 2) }],
                     isError: false 
                });
            }

            const route = this.toolRouter.get(name);
            if (!route) {
                this.error(`Tool not found: ${name}`);
                return res.status(404).json({ 
                    isError: true, 
                    content: [{ type: 'text', text: `Tool '${name}' not found.` }] 
                });
            }

            try {
                // 🚀 Step 2: Executing
                const argsPreview = JSON.stringify(args || {}).slice(0, 100) + (JSON.stringify(args || {}).length > 100 ? '...' : '');
                this.log(`   🚀 Executing: ${name} ${argsPreview}`);
                
                const result = await route.client.callTool({ name, arguments: args || {} });
                
                // ✅ Step 3: Finished
                const toolDuration = Date.now() - toolStart;
                this.log(`   ✅ Finished: ${name} (${toolDuration}ms)`);
                
                res.json(result);
            } catch (error: any) {
                this.error(`Tool execution failed: ${name}`, error);
                res.status(500).json({
                    isError: true,
                    content: [{ type: 'text', text: `Error: ${error.message}` }]
                });
            }
        });

        return new Promise<void>((resolve, reject) => {
            this.server = this.app!.listen(config.port, '127.0.0.1', () => {
                this.log(`🌐 Gateway running on http://127.0.0.1:${config.port}`);
                vscode.window.setStatusBarMessage(`MCP Gateway: On (${config.port})`, 5000);
                resolve();
            });

            this.server.on('error', (e: any) => {
                if (e.code === 'EADDRINUSE') {
                    this.error(`Port ${config.port} is already in use!`);
                    vscode.window.showErrorMessage(`Port ${config.port} is taken. Please stop other MCP servers.`);
                } else {
                    this.error('Server error:', e);
                }
                reject(e);
            });
        });
    }

    async stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.log('🛑 Gateway server stopped.');
        }
        this.connectedClients.forEach(c => c.client.disconnect());
        this.connectedClients = [];
    }
}
