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

        // Routes
        this.app.get('/bridge', (req, res) => {
             const target = req.query.target as string || 'https://chatgpt.com';
             const token = req.query.token as string;
             const port = (this.server?.address() as any)?.port;

             this.log('🌉 Bridge Page requested');
             
             // Minimal Bridge HTML (Aligned with VS Code version)
             res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>WebMCP Bridge</title>
                    <style>
                        body { font-family: sans-serif; background: #1e1e1e; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
                        .loader { border: 3px solid #333; border-top: 3px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 20px; }
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                        .card { background: #252526; padding: 30px; border-radius: 8px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="loader"></div>
                        <h2>Connecting to WebMCP...</h2>
                        <p>Synchronizing with Desktop Gateway...</p>
                    </div>
                    <div id="mcp-data" data-port="${port}" data-token="${token}" data-target="${target}" style="display:none;"></div>
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