import express from 'express';
import cors from 'cors';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as vscode from 'vscode';
import * as path from 'path';

// 定义服务器配置接口
interface ServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
}

interface Config {
    port: number;
    preferredPort?: number; // 新增：首选端口（历史端口）
    allowedExtensionIds: string[];
    mcpServers: Record<string, ServerConfig>;
}

export class GatewayManager {
    private app: express.Express | null = null;
    private server: any = null;
    private toolRouter = new Map<string, { client: Client; definition: any }>();
    private connectedClients: { id: string; client: Client }[] = [];
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel, extensionPath: string) {
        this.outputChannel = outputChannel;
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

    async connectToServers(servers: Record<string, ServerConfig>) {
        this.connectedClients.forEach(c => {
            try {
                c.client.close();
            } catch (e) { }
        });
        this.connectedClients = [];
        this.toolRouter.clear();

        this.log('🔌 Connecting to MCP servers...');

        for (const [serverId, config] of Object.entries(servers)) {
            try {
                let command = config.command;
                let args = [...config.args];
                const env = { ...process.env, ...config.env } as Record<string, string>;

                // === FIX: Windows Compatibility ===
                if (process.platform === 'win32') {
                    if (command === 'npx' || command === 'npm') {
                        command = `${command}.cmd`;
                    }
                }

                // === Logic: Dynamic Workspace Path Resolution ===
                if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
                    args = args.map(arg => {
                        if (arg === '.' || arg === '${workspaceFolder}') {
                            this.log(`   ✨ [${serverId}] Resolved "${arg}" -> Workspace Root`);
                            return root;
                        }
                        return arg;
                    });
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

    // 修改：返回 Promise<number> 表示最终使用的端口
    async start(config: Config): Promise<number> {
        if (this.server) {
            await this.stop();
        }
        await this.connectToServers(config.mcpServers);

        this.app = express();
        this.app.use(express.json());

        const allowedIds = config.allowedExtensionIds || [];
        const isOriginAllowed = (origin: string | undefined): boolean => {
            if (!origin) {
                return true;
            }
            if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
                return true;
            }
            return allowedIds.some(id => origin === `chrome-extension://${id}`);
        };

        if (allowedIds.length > 0) {
             this.log(`🛡️ Whitelisted Extension IDs: ${allowedIds.join(', ')}`);
        } else {
             this.log(`⚠️ No Extension IDs whitelisted. Only localhost allowed.`);
        }

        this.app.use((req, res, next) => {
            const start = Date.now();
            const origin = req.get('origin') || 'Unknown';
            if (req.method !== 'OPTIONS') {
                this.log(`🔔 [${req.method}] ${req.url} <== ${origin}`);
            }
            res.on('finish', () => {
                const duration = Date.now() - start;
                const status = res.statusCode;
                if (req.method !== 'OPTIONS') {
                    const icon = status >= 400 ? '❌' : '   🏁';
                    this.log(`${icon} Status: ${status} (${duration}ms)`);
                }
            });
            next();
        });

        this.app.use((req, res, next) => {
            const origin = req.get('origin');
            if (!isOriginAllowed(origin)) {
                this.log(`⛔ Blocked request from unauthorized origin: ${origin}`);
                return res.status(403).json({ error: "Forbidden" });
            }
            next();
        });

        this.app.use(cors({
            origin: (origin, callback) => {
                if (isOriginAllowed(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error("Not allowed by CORS"));
                }
            }
        }));

        this.app.get('/bridge', (req, res) => {
            const target = req.query.target as string || 'https://chatgpt.com';
            const port = this.server.address().port;
            this.log(`🌉 Bridge handshake requested. Target: ${target}`);
            
            // 返回一个简单的页面，浏览器插件会自动拦截这个页面
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>WebMCP Bridge</title>
                    <style>
                        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #1e1e1e; color: #fff; }
                        .loader { border: 4px solid #333; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 20px; }
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    </style>
                </head>
                <body>
                    <div class="loader"></div>
                    <h2>Connecting to WebMCP...</h2>
                    <p>Port: ${port}</p>
                    <p>Target: ${target}</p>
                </body>
                </html>
            `);
        });

        this.app.get('/v1/tools', (req, res) => {
            const tools = Array.from(this.toolRouter.values()).map(t => t.definition);
            this.log(`   🚀 Executing: GET /v1/tools (Discovery)`);
            this.log(`   ✅ Returned ${tools.length} tools`);
            res.json({ tools });
        });

        this.app.post('/v1/tools/call', async (req, res) => {
            let { name, arguments: args } = req.body;
            const toolStart = Date.now();

            if (args && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
                const fixPath = (p: string) => {
                    if (typeof p === 'string' && !path.isAbsolute(p)) {
                        return path.join(root, p);
                    }
                    return p;
                };

                if (args.path) {
                    args.path = fixPath(args.path);
                }
                if (args.source) {
                    args.source = fixPath(args.source);
                }
                if (args.destination) {
                    args.destination = fixPath(args.destination);
                }
                if (Array.isArray(args.paths)) {
                    args.paths = args.paths.map((p: any) => fixPath(p));
                }
            }

            if (name === 'list_tools') {
                const tools = Array.from(this.toolRouter.values()).map(t => t.definition);
                const uniqueTools = [...new Map(tools.map(item => [item.name, item])).values()];
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
                const argsPreview = JSON.stringify(args || {}).slice(0, 100) + (JSON.stringify(args || {}).length > 100 ? '...' : '');
                this.log(`   🚀 Executing: ${name} ${argsPreview}`);
                const result = await route.client.callTool({ name, arguments: args || {} });
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

        // === 5. Dynamic Port Allocation with Stickiness ===
        return new Promise<number>((resolve, reject) => {
            const tryListen = (currentPort: number, attempt: number) => {
                const maxRetries = 20;
                if (attempt > maxRetries) {
                    const msg = `Could not find an open port after ${maxRetries} attempts.`;
                    this.error(msg);
                    vscode.window.showErrorMessage(msg);
                    reject(new Error(msg));
                    return;
                }

                this.server = this.app!.listen(currentPort, '127.0.0.1', () => {
                    this.log(`🌐 Gateway running on http://127.0.0.1:${currentPort}`);
                    vscode.window.setStatusBarMessage(`MCP Gateway: On (${currentPort})`, 5000);
                    resolve(currentPort); // 返回成功绑定的端口
                });

                this.server.on('error', (e: any) => {
                    if (e.code === 'EADDRINUSE') {
                        // 如果是首选端口失败，打个日志，然后从默认端口开始尝试
                        if (currentPort === config.preferredPort) {
                             this.log(`⚠️ Preferred port ${currentPort} is busy. Falling back to default range.`);
                             // 递归调用：尝试 default port，重置 attempt
                             tryListen(config.port, 0);
                        } else {
                             this.log(`⚠️ Port ${currentPort} is busy, trying ${currentPort + 1}...`);
                             tryListen(currentPort + 1, attempt + 1);
                        }
                    } else {
                        this.error('Server error:', e);
                        reject(e);
                    }
                });
            };

            // 优先尝试 Preferred Port (如果存在且不等于 default port)
            // 如果 preferred == default，直接进入主逻辑，不用特殊处理
            if (config.preferredPort && config.preferredPort !== config.port) {
                 this.log(`🔄 Trying sticky port from last session: ${config.preferredPort}`);
                 tryListen(config.preferredPort, 0);
            } else {
                 tryListen(config.port, 0);
            }
        });
    }

    async stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.log('🛑 Gateway server stopped.');
        }
        this.connectedClients.forEach(c => {
            try {
                c.client.close();
            } catch (e) { }
        });
        this.connectedClients = [];
    }
}