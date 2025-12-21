import express from 'express';
import cors from 'cors';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import * as crypto from 'node:crypto';
import { Server as HttpServer } from 'http';
import { GatewayConfig, ServerConfig, StartResult, WebMCPConfig } from './types';

export interface GatewayHooks {
    log: (message: string) => void;
    error: (message: string, err?: any) => void;
    onActivity?: () => void;
    getConfig: (workspaceId: string, scope: 'merged' | 'global' | 'workspace') => Promise<WebMCPConfig>;
    saveConfig: (workspaceId: string, scope: 'global' | 'workspace', updates: Partial<WebMCPConfig>) => Promise<void>;
    resetConfig?: (workspaceId: string, scope: 'global' | 'workspace') => Promise<void>;
    restoreDefaultConfig?: (workspaceId: string) => Promise<void>;
    getInternalTools: () => any[];
    handleInternalToolCall: (name: string, args: any) => Promise<any> | undefined;
}

export abstract class BaseGatewayManager {
    protected app: express.Express | null = null;
    protected server: HttpServer | null = null;
    protected toolRouter = new Map<string, { client: Client; definition: any; serverId: string }>();
    protected connectedClients: { id: string; client: Client }[] = [];
    protected authToken: string = '';

    constructor(
        protected hooks: GatewayHooks,
        protected workspaceId: string = 'default'
    ) {
        this.authToken = crypto.randomUUID();
    }

    protected log(message: string) {
        this.hooks.log(message);
    }

    protected error(message: string, err?: any) {
        this.hooks.error(message, err);
    }

    protected onActivity() {
        if (this.hooks.onActivity) {
            this.hooks.onActivity();
        }
    }

    async connectToServers(servers: Record<string, ServerConfig>, enabledServices?: string[]) {
        // Cleanup existing
        this.connectedClients.forEach(c => { try { c.client.close(); } catch { /* ignore */ } });
        this.connectedClients = [];
        this.toolRouter.clear();

        this.log('🔌 Connecting to MCP servers...');

        for (const [serverId, config] of Object.entries(servers)) {
            if (config.disabled) continue;
            if (enabledServices && !enabledServices.includes(serverId)) {
                this.log(`   -> Skipping [${serverId}] (Not enabled)`);
                continue;
            }

            try {
                let client: Client;
                if (config.type === 'http') {
                    if (!config.url) throw new Error("Missing URL");
                    this.log(`   -> Connecting [${serverId}] via HTTP: ${config.url}`);
                    const transport = new StreamableHTTPClientTransport(new URL(config.url), { requestInit: { headers: config.headers } });
                    client = new Client({ name: "webmcp-gateway", version: "1.0.0" }, { capabilities: {} });
                    await client.connect(transport);

                } else if (config.type === 'sse') {
                    if (!config.url) throw new Error("Missing URL");
                    this.log(`   -> Connecting [${serverId}] via SSE: ${config.url}`);
                    const transport = new SSEClientTransport(new URL(config.url), {
                        requestInit: { headers: config.headers },
                        eventSourceInit: { headers: config.headers } as any
                    });
                    client = new Client({ name: "webmcp-gateway", version: "1.0.0" }, { capabilities: {} });
                    await client.connect(transport);

                } else {
                    // Stdio
                    const command = config.command || 'npx';
                    const args = config.args || [];
                    const env = { ...process.env, ...config.env } as Record<string, string>;

                    this.log(`   -> Starting [${serverId}]: ${command} ${args.join(' ')}`);
                    const transport = new StdioClientTransport({ command, args, env });
                    client = new Client({ name: "webmcp-gateway", version: "1.0.0" }, { capabilities: {} });
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

    protected _generateGroupedTools() {
        const allTools = Array.from(this.toolRouter.values()).map(t => ({ ...t.definition, _server: t.serverId }));
        
        // Inject Internal Tools
        const internalTools = this.hooks.getInternalTools();
        internalTools.forEach(tool => {
            allTools.push({ ...tool, _server: 'internal' });
        });

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

    async start(config: GatewayConfig): Promise<StartResult> {
        if (this.server) await this.stop();
        await this.connectToServers(config.mcpServers, config.enabledServices);

        if (!this.authToken) this.authToken = crypto.randomUUID();

        this.app = express();
        this.app.use(express.json());

        // CORS
        this.app.use(cors({
            origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
                if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.startsWith('chrome-extension://')) {
                    cb(null, true);
                } else if (config.allowedOrigins?.includes(origin)) {
                    cb(null, true);
                } else {
                    cb(null, true); // Permissive for now, matching desktop
                }
            }
        }));

        // Activity and Logging Middleware
        this.app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
            this.onActivity();
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
        this.setupRoutes();

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
            tryListen(config.preferredPort || config.port);
        });
    }

    protected setupRoutes() {
        if (!this.app) return;

        this.app.get('/v1/config', async (req, res) => {
            const scope = (req.query.scope as 'merged' | 'global' | 'workspace') || 'merged';
            const workspaceId = (req.query.workspaceId as string) || this.workspaceId;

            this.log(`📥 Config Sync: Pull for workspace ${workspaceId} (scope: ${scope})`);
            let configData = await this.hooks.getConfig(workspaceId, scope);

            if (scope === 'workspace' && Object.values(configData).every(v => v === undefined || v === '')) {
                configData = await this.hooks.getConfig(workspaceId, 'merged');
                this.log(`🛡️ Initialized workspace config with merged values (inheritance)`);
            }

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

        this.app.post('/v1/config', async (req, res) => {
            const scope = (req.query.scope as 'global' | 'workspace') || 'workspace';
            const workspaceId = (req.query.workspaceId as string) || this.workspaceId;
            const config = req.body.config;

            if (!config) return res.status(400).json({ error: "Missing config" });

            this.log(`📤 Config Sync: Save for workspace ${workspaceId} (scope: ${scope})`);
            await this.hooks.saveConfig(workspaceId, scope, config);
            res.json({ success: true });
        });

        this.app.delete('/v1/config', async (req, res) => {
            const scope = (req.query.scope as 'global' | 'workspace') || 'workspace';
            const workspaceId = (req.query.workspaceId as string) || this.workspaceId;

            if (this.hooks.resetConfig) {
                await this.hooks.resetConfig(workspaceId, scope);
                this.log(`🗑️ Config Sync: Reset ${scope} for workspace ${workspaceId}`);
                res.json({ success: true });
            } else {
                res.status(501).json({ error: "Not implemented" });
            }
        });

        this.app.post('/v1/config/restore', async (req, res) => {
            const workspaceId = (req.query.workspaceId as string) || this.workspaceId;
            if (this.hooks.restoreDefaultConfig) {
                this.log(`🔄 Config Restore: Resetting workspace ${workspaceId} to inherit global`);
                await this.hooks.restoreDefaultConfig(workspaceId);
                res.json({ success: true });
            } else {
                res.status(501).json({ error: "Not implemented" });
            }
        });

        this.app.get('/bridge', (req: express.Request, res: express.Response) => {
            const target = req.query.target as string || 'https://chatgpt.com';
            const token = req.query.token as string;
            const address = this.server?.address();
            const port = address && typeof address !== 'string' ? address.port : 0;

            res.send(this.getBridgeHtml(port, token, target));
        });

        this.app.get('/v1/tools', (_req: express.Request, res: express.Response) => {
            return res.json({ groups: this._generateGroupedTools() });
        });

        this.app.post('/v1/tools/call', async (req: express.Request, res: express.Response) => {
            const { name, arguments: args } = req.body;

            // Internal Tools
            if (name === 'list_tools') {
                return res.json({ content: [{ type: 'text', text: JSON.stringify(this._generateGroupedTools(), null, 2) }] });
            }

            const internalResult = await this.hooks.handleInternalToolCall(name, args);
            if (internalResult !== undefined) {
                return res.json(internalResult);
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
    }

    protected getBridgeHtml(port: number, token: string, target: string) {
        return `
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
                        <p>Synchronizing with Gateway...</p>
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
                        setTimeout(() => {
                            const isInstalled = document.documentElement.getAttribute('data-extension-installed') === 'true';
                            const bodyText = document.body.innerText;
                            const isBusyOrConflict = bodyText.includes('Conflict') || bodyText.includes('Switching') || bodyText.includes('Connected');

                            if (!isInstalled && !isBusyOrConflict) {
                                document.getElementById('main-card').style.display = 'none';
                                document.getElementById('install-guide').style.display = 'block';
                            }
                        }, 1500);
                    </script>
                </body>
                </html>
            `;
    }

    async stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.log('🛑 Gateway stopped');
        }
        this.connectedClients.forEach(c => { try { c.client.close(); } catch { /* ignore */ } });
        this.connectedClients = [];
    }
}
