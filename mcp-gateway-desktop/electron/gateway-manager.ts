import express from 'express';
import cors from 'cors';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
// @ts-ignore
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import * as crypto from 'node:crypto';
import { Server as HttpServer } from 'http';

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
    name: "run_in_terminal",
    description: "Execute a command in the user's terminal (Not fully supported in Desktop yet).",
    inputSchema: {
        type: "object",
        properties: {
            command: { type: "string" }
        },
        required: ["command"]
    }
};

const BASIC_TOOLS = [
    'read_file', 'read_text_file', 'write_file', 'edit_file', 
    'list_directory', 'list_directory_with_sizes', 
    'run_in_terminal', 'execute_command', 
    'search_files', 'get_tool_definitions', 'list_tools'
];

export class GatewayManager {
    private app: express.Express | null = null;
    private server: HttpServer | null = null;
    private toolRouter = new Map<string, { client: Client; definition: any; serverId: string }>();
    private connectedClients: { id: string; client: Client }[] = [];
    private authToken: string = '';
    
    // Callbacks
    private logFn: (msg: string) => void;

    constructor(logFn: (msg: string) => void) {
        this.logFn = logFn;
        this.authToken = crypto.randomUUID();
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
        this.connectedClients.forEach(c => { try { c.client.close(); } catch {} });
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
        const groups: Record<string, { tools: any[], hidden_tools: string[] }> = {};
        
        // Gather
        const allTools = Array.from(this.toolRouter.values()).map(t => ({ ...t.definition, _server: t.serverId }));
        allTools.push({ ...RUN_IN_TERMINAL_TOOL, _server: 'internal' });

        allTools.forEach(tool => {
             const server = tool._server || 'unknown';
             if (!groups[server]) groups[server] = { tools: [], hidden_tools: [] };
             
             // Hot vs Cold
             if (BASIC_TOOLS.includes(tool.name)) {
                 const { _server, ...clean } = tool;
                 groups[server].tools.push(clean);
             } else {
                 groups[server].hidden_tools.push(tool.name);
             }
        });

        return Object.entries(groups).map(([server, data]) => ({
            server,
            tools: data.tools,
            hidden_tools: data.hidden_tools.sort()
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
            origin: (origin, cb) => {
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
        this.app.use((req, _res, next) => {
            if (req.method !== 'OPTIONS' && req.path !== '/bridge') {
                this.log(`🔔 [${req.method}] ${req.url}`);
            }
            next();
        });

        // Auth Middleware
        this.app.use((req, res, next) => {
            const publicPaths = ['/bridge', '/v1/config', '/favicon.ico'];
            if (req.method === 'OPTIONS' || publicPaths.includes(req.path)) {
                return next();
            }
            const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token as string;
            if (token !== this.authToken) {
                this.log(`⚠️ Unauthorized access attempt: ${req.path}`);
                return res.status(401).json({ error: 'Unauthorized' });
            }
            next();
        });

        // Routes

        // Config Sync (Required for Extension Handshake)
        this.app.get('/v1/config', (_req, res) => {
             res.json({ config: null });
        });
        this.app.post('/v1/config', (_req, res) => {
             res.json({ success: true });
        });

        this.app.get('/bridge', (req, res) => {
             const target = req.query.target as string || 'https://chatgpt.com';
             const token = req.query.token as string;
             const port = (this.server?.address() as any)?.port;

             this.log('🌉 Bridge Page requested');
             
             // Full Bridge HTML with Detection Logic
             res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>WebMCP Bridge</title>
                    <style>
                        body { font-family: 'Segoe UI', sans-serif; background: #1e1e1e; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin:0; }
                        .loader { border: 3px solid #333; border-top: 3px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                        .card { background: #252526; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 400px; width: 90%; transition: all 0.3s; }
                        h2 { margin-top: 0; color: #3498db; font-size: 24px; }
                        p { color: #aaa; margin-bottom: 20px; line-height: 1.5; }
                        .btn { display: inline-block; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; transition: background 0.2s; border: none; cursor: pointer; }
                        .btn:hover { background: #2980b9; }
                        .btn-secondary { background: transparent; border: 1px solid #555; color: #ccc; margin-top: 10px; font-size: 14px; }
                        .btn-secondary:hover { border-color: #888; color: #fff; }
                        .hidden { display: none; }
                        .error-state { border-top: 4px solid #e74c3c; }
                        .error-state h2 { color: #e74c3c; }
                    </style>
                </head>
                <body>
                    
                    <div class="card" id="loading-card">
                        <div class="loader"></div>
                        <h2>Connecting...</h2>
                        <p>Waiting for WebMCP Bridge extension...</p>
                    </div>

                    
                    <div class="card hidden" id="action-card">
                        <h2 id="msg-title">🧩 Extension Missing</h2>
                        <p id="msg-desc">To enable AI connection, you need the <b>WebMCP Bridge</b> extension.</p>
                        
                        <div id="btn-install-group">
                            <a href="https://chromewebstore.google.com/detail/webmcp-bridge/hifhgpldhlnpjmcobflcbnfpiefannkh" target="_blank" class="btn">Get Extension</a>
                        </div>
                        
                        <div class="error-details hidden" id="debug-info" style="margin: 15px 0; font-family: monospace; font-size: 12px; color: #666; background: #000; padding: 10px; border-radius: 4px; text-align: left;">
                            Port: ${port}<br>Target: ${target}
                        </div>

                        <br>
                        <button onclick="forceRedirect()" class="btn btn-secondary">Skip & Open Website (No MCP)</button>
                    </div>

                    
                    <div id="mcp-data" data-port="${port}" data-token="${token}" data-target="${target}" style="display:none;"></div>

                    <script>
                        const targetUrl = "${target}";
                        function forceRedirect() { window.location.href = targetUrl; }

                        setTimeout(() => {
                            const isInstalled = document.documentElement.getAttribute('data-extension-installed') === 'true';
                            const bodyText = document.body.innerText;
                            const isBusy = bodyText.includes('Connected') || bodyText.includes('Redirecting');

                            if (isBusy) return; // Already working

                            const loader = document.getElementById('loading-card');
                            const card = document.getElementById('action-card');
                            const title = document.getElementById('msg-title');
                            const desc = document.getElementById('msg-desc');
                            const installGroup = document.getElementById('btn-install-group');
                            const debugInfo = document.getElementById('debug-info');

                            if (!isInstalled) {
                                // Case 1: Not installed
                                loader.classList.add('hidden');
                                card.classList.remove('hidden');
                                card.classList.add('error-state');
                            } else {
                                // Case 2: Installed but stuck (wait a bit more)
                                loader.querySelector('p').innerText = "Extension detected. Handshaking...";
                                
                                setTimeout(() => {
                                    // Final Timeout Fallback
                                    loader.classList.add('hidden');
                                    card.classList.remove('hidden');
                                    card.classList.add('error-state');
                                    
                                    title.innerText = "Connection Timeout";
                                    desc.innerHTML = "Extension detected but failed to connect.<br>Please check if the Gateway port is blocked.";
                                    installGroup.style.display = 'none'; // Hide install button since it is installed
                                    debugInfo.classList.remove('hidden');
                                }, 3000);
                            }
                        }, 2000);
                    </script>
                </body>
                </html>
             `);
        });

        this.app.get('/v1/tools', (_req, res) => {
             res.json({ groups: this._generateGroupedTools() });
        });

        this.app.post('/v1/tools/call', async (req, res) => {
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
        this.connectedClients.forEach(c => { try { c.client.close(); } catch {} });
        this.connectedClients = [];
    }
}