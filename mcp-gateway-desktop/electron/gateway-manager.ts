import express from 'express';
import cors from 'cors';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
// @ts-ignore
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import * as crypto from 'node:crypto';
import { Server as HttpServer } from 'http';
import { ConfigManager } from './config-manager';

// --- Interfaces ---

export interface ServerConfig {
    type?: 'stdio' | 'sse' | 'http';
    command?: string;
    args?: string[];
    url?: string;
    headers?: Record<string, string>;
    env?: Record<string, string>;
    disabled?: boolean;
}

export interface GatewayConfig {
    port: number;
    mcpServers: Record<string, ServerConfig>;
    allowedOrigins?: string[];
}

interface StartResult {
    port: number;
    token: string;
}

// --- Internal Tools ---

const RUN_IN_TERMINAL_TOOL = {
    name: 'run_in_terminal',
    description: 'Run a shell command in the local system terminal. This is useful for long running tasks, starting servers, or interactive commands.',
    inputSchema: {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'The shell command to run' },
            cwd: { type: 'string', description: 'Working directory' }
        },
        required: ['command']
    }
};

export class GatewayManager {
    private app: express.Express | null = null;
    private server: HttpServer | null = null;
    private toolRouter = new Map<string, { client: Client; definition: any; serverId: string }>();
    private connectedClients: { id: string; client: Client }[] = [];
    private authToken: string = '';
    private workspaceId: string = 'default';

    // Callbacks
    private logFn: (msg: string) => void;

    constructor(logFn: (msg: string) => void, workspaceId?: string) {
        this.logFn = logFn;
        this.authToken = crypto.randomUUID();
        if (workspaceId) this.workspaceId = workspaceId;
    }

    private log(message: string) {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        this.logFn(`[${time}] ${message}`);
    }

    private error(message: string, err?: any) {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        this.logFn(`[${time}] ❌ ${message} ${err ? (err.message || JSON.stringify(err)) : ''}`);
    }

    // --- Server Connection Logic ---

    async connectToServers(servers: Record<string, ServerConfig>) {
        // Cleanup existing
        this.connectedClients.forEach(c => { try { c.client.close(); } catch { } });
        this.connectedClients = [];
        this.toolRouter.clear();

        this.log('🔌 Connecting to MCP servers...');

        for (const [serverId, config] of Object.entries(servers)) {
            if (config.disabled) continue;

            try {
                let client: Client;
                if (config.type === 'http') {
                    if (!config.url) throw new Error("Missing URL");
                    this.log(`   -> Connecting [${serverId}] via HTTP: ${config.url}`);
                    const transport = new StreamableHTTPClientTransport(new URL(config.url), { requestInit: { headers: config.headers } });
                    client = new Client({ name: "mcp-gateway-desktop", version: "1.0.0" }, { capabilities: {} });
                    await client.connect(transport);

                } else if (config.type === 'sse') {
                    if (!config.url) throw new Error("Missing URL");
                    this.log(`   -> Connecting [${serverId}] via SSE: ${config.url}`);
                    const transport = new SSEClientTransport(new URL(config.url), {
                        requestInit: { headers: config.headers },
                        eventSourceInit: { headers: config.headers } as any
                    });
                    client = new Client({ name: "mcp-gateway-desktop", version: "1.0.0" }, { capabilities: {} });
                    await client.connect(transport);

                } else {
                    // Stdio
                    const command = config.command || 'npx';
                    const args = config.args || [];
                    const env = { ...process.env, ...config.env } as Record<string, string>;

                    // Fix for Windows npx/npm
                    let finalCommand = command;
                    if (process.platform === 'win32' && (command === 'npx' || command === 'npm')) {
                        finalCommand = `${command}.cmd`;
                    }

                    this.log(`   -> Starting [${serverId}]: ${finalCommand} ${args.join(' ')}`);
                    const transport = new StdioClientTransport({ command: finalCommand, args, env });
                    client = new Client({ name: "mcp-gateway-desktop", version: "1.0.0" }, { capabilities: {} });
                    await client.connect(transport);
                }

                this.connectedClients.push({ id: serverId, client });

                // Discovery
                const list = await client.listTools();
                this.log(`   ✅ [${serverId}] Connected. Loaded ${list.tools.length} tools.`);

                list.tools.forEach((tool: any) => {
                    if (this.toolRouter.has(tool.name)) {
                        this.log(`   ⚠️ Warning: Tool '${tool.name}' overridden by ${serverId}`);
                    }
                    this.toolRouter.set(tool.name, { client, definition: tool, serverId });
                });

            } catch (err: any) {
                this.error(`Failed to connect to [${serverId}]`, err);
            }
        }
    }

    // --- Tool Grouping Helper ---
    private _generateGroupedTools() {
        const allTools = Array.from(this.toolRouter.values()).map(t => ({ ...t.definition, _server: t.serverId }));
        allTools.push({ ...RUN_IN_TERMINAL_TOOL, _server: 'internal' });

        const groups: Record<string, { tools: any[] }> = {};

        allTools.forEach(tool => {
            const server = tool._server || 'unknown';
            if (!groups[server]) {
                groups[server] = { tools: [] };
            }
            const { _server, ...cleanTool } = tool;
            groups[server].tools.push(cleanTool);
        });

        return Object.entries(groups).map(([server, data]) => ({
            server,
            tools: data.tools
        }));
    }

    // --- Gateway Lifecycle ---

    async start(config: GatewayConfig): Promise<StartResult> {
        if (this.server) await this.stop();
        await this.connectToServers(config.mcpServers);

        if (!this.authToken) this.authToken = crypto.randomUUID();

        this.app = express();
        this.app.use(express.json());

        // CORS
        this.app.use(cors({
            origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
                // Allow all for Desktop context for now, or match VS Code logic
                if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.startsWith('chrome-extension://')) {
                    cb(null, true);
                } else {
                    // this.log(`⚠️ CORS Warning: ${origin}`);
                    cb(null, true); // Permissive for local tool
                }
            }
        }));

        // Logging Middleware
        this.app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
            if (req.method !== 'OPTIONS' && req.path !== '/bridge') {
                this.log(`🔔 [${req.method}] ${req.url}`);
            }
            next();
        });

        // Auth Middleware
        this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            const publicPaths = ['/bridge', '/favicon.ico'];
            if (req.method === 'OPTIONS' || publicPaths.includes(req.path)) {
                return next();
            }

            const token = req.headers['x-webmcp-token'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.token as string;
            if (token !== this.authToken) {
                this.log(`⚠️ Unauthorized access attempt: ${req.path}`);
                return res.status(401).json({ error: 'Unauthorized' });
            }
            next();
        });

        // Routes

        // v1/config: Returns the merged configuration (for browser extension UI)
        this.app.get('/v1/config', async (req, res) => {
            const scope = (req.query.scope as 'merged' | 'global' | 'workspace') || 'merged';
            const workspaceId = this.workspaceId;

            this.log(`📥 Config Sync: Pull for workspace ${workspaceId} (scope: ${scope})`);
            let configData = await ConfigManager.getConfig(workspaceId, scope);

            // If it's a workspace scope and the config is effectively empty, 
            // return the merged config to provide inherited values for initialization.
            if (scope === 'workspace' && Object.values(configData).every(v => v === undefined || v === '')) {
                configData = await ConfigManager.getConfig(workspaceId, 'merged');
                this.log(`🛡️ Initialized workspace config with merged values (inheritance)`);
            }

            // Ensure protected_tools is initialized
            if (configData.protected_tools === undefined) {
                const allToolNames: string[] = [];
                const grouped = this._generateGroupedTools();
                grouped.forEach(g => {
                    g.tools.forEach(t => allToolNames.push(t.name));
                });
                configData.protected_tools = allToolNames;
                this.log(`🛡️ Initialized protected_tools with ${allToolNames.length} tools`);
            }

            res.json({ config: configData });
        });

        // v1/config: Save configuration
        this.app.post('/v1/config', async (req, res) => {
            const scope = (req.query.scope as 'global' | 'workspace') || 'workspace';
            const workspaceId = this.workspaceId;
            const config = req.body.config;

            if (!config) return res.status(400).json({ error: "Missing config" });

            this.log(`📤 Config Sync: Save for workspace ${workspaceId} (scope: ${scope})`);
            await ConfigManager.saveConfig(workspaceId, scope, config);
            res.json({ success: true });
        });

        // v1/config/restore: Restore workspace config to default (inherits from global)
        this.app.post('/v1/config/restore', async (_req, res) => {
            const workspaceId = this.workspaceId;
            this.log(`🔄 Config Restore: Resetting workspace ${workspaceId} to inherit global`);
            await ConfigManager.restoreDefault(workspaceId);
            res.json({ success: true });
        });

        this.app.get('/bridge', (req: express.Request, res: express.Response) => {
            const target = req.query.target as string || 'https://chatgpt.com';
            const token = req.query.token as string;
            const address = this.server?.address();
            const port = address && typeof address !== 'string' ? address.port : 0;

            this.log('🌉 Bridge Page requested');

            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>WebMCP Bridge</title>
                    <style>
                        body { font-family: 'Segoe UI', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #1e1e1e; color: #fff; text-align: center; }
                        .loader { border: 3px solid #333; border-top: 3px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 20px; }
                        .card { background: #252526; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); max-width: 400px; }
                        h2 { margin-top: 0; color: #3498db; }
                        p { color: #cccccc; }
                        .warn { color: #e67e22; font-size: 0.9em; margin-top: 10px; }
                        button { background: #3498db; border: none; padding: 10px 20px; color: white; border-radius: 4px; cursor: pointer; margin-top: 15px; }
                        button:hover { background: #2980b9; }
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    </style>
                </head>
                <body>
                    <div class="card" id="main-card">
                        <div class="loader" id="loader"></div>
                        <h2>Connecting to WebMCP...</h2>
                        <p>Synchronizing with Desktop...</p>
                    </div>

                    
                    <div id="mcp-data" data-port="${port}" data-token="${token}" data-target="${target}" style="display:none;"></div>
                    
                    
                    <div class="card" id="install-guide" style="display:none; border: 1px solid #e74c3c; box-shadow: 0 4px 15px rgba(231, 76, 60, 0.2);">
                        <h2 style="color:#e74c3c; margin-bottom:10px">⚠️ Extension Required</h2>
                        <p style="margin-bottom:20px">To enable auto-connection, you need the companion browser extension:</p>
                        <div style="background:#333; padding:10px; border-radius:6px; margin-bottom:20px; font-weight:bold; color:#fff">
                            🧩 WebMCP Bridge
                        </div>
                        <a href="#" onclick="alert('Please search for [WebMCP Bridge] in your browser store.'); return false;" style="display:inline-block; background:#e74c3c; color:white; padding:10px 20px; text-decoration:none; border-radius:4px; font-weight:bold;">
                            Get Browser Extension
                        </a>
                        <p class="warn" style="margin-top:15px; font-size:12px">Already installed? Try reloading this page.</p>
                    </div>

                    <script>
                        // 检测逻辑：等待 1.5 秒
                        setTimeout(() => {
                            // 1. 检查插件是否打上了标记
                            const isInstalled = document.documentElement.getAttribute('data-extension-installed') === 'true';
                            
                            // 2. 双重保险：检查页面内容是否已经被插件修改（例如出现了冲突提示）
                            const bodyText = document.body.innerText;
                            const isBusyOrConflict = bodyText.includes('Conflict') || bodyText.includes('Switching') || bodyText.includes('Connected');

                            // 只有在既没安装，也没发生冲突的情况下，才显示安装引导
                            if (!isInstalled && !isBusyOrConflict) {
                                document.getElementById('main-card').style.display = 'none';
                                document.getElementById('install-guide').style.display = 'block';
                            }
                        }, 1500);
                    </script>
                </body>
                </html>
            `);
        });

        this.app.get('/v1/tools', (_req: express.Request, res: express.Response) => {
            this.log('🚀 Executing: GET /v1/tools (Discovery)');
            return res.json({ groups: this._generateGroupedTools() });
        });

        this.app.post('/v1/tools/call', async (req: express.Request, res: express.Response) => {
            const { name, arguments: args } = req.body;

            // Internal Tools
            if (name === 'list_tools') {
                return res.json({ content: [{ type: 'text', text: JSON.stringify(this._generateGroupedTools(), null, 2) }] });
            }

            // Routing
            const route = this.toolRouter.get(name);
            if (!route) {
                return res.status(404).json({ isError: true, content: [{ type: 'text', text: `Tool ${name} not found` }] });
            }

            try {
                this.log(`🚀 Executing ${name}...`);
                const result = await route.client.callTool({ name, arguments: args || {} });
                this.log(`✅ Finished ${name}`);
                res.json(result);
            } catch (err: any) {
                this.error(`Tool execution failed`, err);
                res.status(500).json({ isError: true, content: [{ type: 'text', text: err.message }] });
            }
        });

        // Start Listening
        return new Promise((resolve, reject) => {
            if (!this.app) return reject(new Error("Express app not initialized"));
            const tryListen = (p: number) => {
                this.server = this.app!.listen(p, '127.0.0.1', () => {
                    this.log(`🌐 Gateway running on http://127.0.0.1:${p}`);
                    resolve({ port: p, token: this.authToken });
                });
                this.server.on('error', (e: any) => {
                    if (e.code === 'EADDRINUSE') {
                        this.log(`⚠️ Port ${p} in use, trying ${p + 1}...`);
                        tryListen(p + 1);
                    } else {
                        reject(e);
                    }
                });
            };
            tryListen(config.port);
        });
    }

    async stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.log('🛑 Gateway stopped');
        }
        this.connectedClients.forEach(c => { try { c.client.close(); } catch { } });
        this.connectedClients = [];
    }
}