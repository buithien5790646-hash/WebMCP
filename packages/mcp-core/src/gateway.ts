import express from 'express';
import cors from 'cors';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
// @ts-ignore
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import * as path from 'path';
import * as crypto from 'crypto';
import { ToolExecutionPayload } from '@webmcp/shared';
import { GatewayConfig, IGatewayLogger, IGatewayStorage, IRuntimeContext, ServerConfig, StartResult } from './interfaces';

const RUN_IN_TERMINAL_TOOL = {
    name: "run_in_terminal",
    description: "Execute a command in the terminal. Returns immediately.",
    inputSchema: {
        type: "object",
        properties: {
            command: { type: "string", description: "The command to execute" },
            auto_focus: { type: "boolean", description: "Focus the terminal", default: true }
        },
        required: ["command"]
    }
};

const GET_TOOL_DEFINITIONS_TOOL = {
    name: "get_tool_definitions",
    description: "Fetch detailed schemas for tools that are in 'Summary Mode'.",
    inputSchema: {
        type: "object",
        properties: {
            tool_names: {
                type: "array",
                items: { type: "string" },
                description: "List of tool names"
            }
        },
        required: ["tool_names"]
    }
};

const BASIC_TOOLS = [
    'read_file', 'read_text_file', 'write_file', 'edit_file', 
    'list_directory', 'list_directory_with_sizes', 
    'run_in_terminal', 'execute_command', 
    'search_files', 'get_tool_definitions', 'list_tools'
];

export class McpGateway {
    private app: express.Express | null = null;
    private server: any = null;
    private toolRouter = new Map<string, { client: Client; definition: any; serverId: string }>();
    private connectedClients: { id: string; client: Client }[] = [];

    private logger: IGatewayLogger;
    private storage: IGatewayStorage;
    private context: IRuntimeContext;
    private authToken: string = '';
    private watchdogTimer: NodeJS.Timeout | null = null;
    private readonly WATCHDOG_TIMEOUT = 30 * 60 * 1000;
    private onAutoStop: (() => void) | null = null;
    private onStatusChange: ((status: string, port?: number) => void) | null = null;

    constructor(
        logger: IGatewayLogger, 
        storage: IGatewayStorage, 
        context: IRuntimeContext,
        onAutoStop?: () => void,
        onStatusChange?: (status: string, port?: number) => void
    ) {
        this.logger = logger;
        this.storage = storage;
        this.context = context;
        this.onAutoStop = onAutoStop || null;
        this.onStatusChange = onStatusChange || null;
        this.authToken = crypto.randomUUID();
    }

    private _generateGroupedTools() {
        const allTools = Array.from(this.toolRouter.values()).map(t => ({ ...t.definition, _server: t.serverId }));
        allTools.push({ ...RUN_IN_TERMINAL_TOOL, _server: 'internal' });
        allTools.push({ ...GET_TOOL_DEFINITIONS_TOOL, _server: 'internal' });

        const groups: Record<string, { tools: any[], hidden_tools: string[] }> = {};

        allTools.forEach(tool => {
            const server = tool._server || 'unknown';
            if (!groups[server]) {
                groups[server] = { tools: [], hidden_tools: [] };
            }

            if (BASIC_TOOLS.includes(tool.name)) {
                const { _server, ...cleanTool } = tool;
                groups[server].tools.push(cleanTool);
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

    private resetWatchdog() {
        if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
        this.watchdogTimer = setTimeout(() => {
            this.logger.info('💤 No activity for 30 minutes. Shutting down...');
            this.stop();
            if (this.onAutoStop) this.onAutoStop();
        }, this.WATCHDOG_TIMEOUT);
    }

    private log(message: string) {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        this.logger.appendLine(`[${time}] ${message}`);
    }

    async connectToServers(servers: Record<string, ServerConfig>) {
        this.connectedClients.forEach(c => {
            try { c.client.close(); } catch (e) { }
        });
        this.connectedClients = [];
        this.toolRouter.clear();

        this.log('🔌 Connecting to MCP servers...');

        for (const [serverId, config] of Object.entries(servers)) {
            if (config.disabled === true) {
                this.log(`   -> Skipping [${serverId}] (Disabled)`);
                continue;
            }

            try {
                let client: Client;

                if (config.type === 'http') {
                    if (!config.url) throw new Error("Missing 'url' for HTTP config");
                    this.log(`   -> Connecting [${serverId}] via HTTP: ${config.url}`);
                    const transport = new StreamableHTTPClientTransport(new URL(config.url), { requestInit: { headers: config.headers } });
                    client = new Client({ name: "webmcp-gateway", version: "1.0.0" }, { capabilities: {} });
                    await client.connect(transport);
                } else if (config.type === 'sse') {
                    if (!config.url) throw new Error("Missing 'url' for SSE config");
                    this.log(`   -> Connecting [${serverId}] via SSE: ${config.url}`);
                    const transport = new SSEClientTransport(new URL(config.url), {
                        requestInit: { headers: config.headers } as any,
                        // @ts-ignore
                        eventSourceInit: { headers: config.headers },
                    });
                    client = new Client({ name: "webmcp-gateway", version: "1.0.0" }, { capabilities: {} });
                    await client.connect(transport);
                } else {
                    const replaceVars = (str: string) => str.replace(/\$\{extensionPath\}/g, this.context.extensionPath);

                    let command = replaceVars(config.command!);
                    let args = (config.args || []).map(arg => replaceVars(arg));
                    const env = { ...process.env, ...config.env } as Record<string, string>;

                    if (process.platform === 'win32') {
                        if (command === 'npx' || command === 'npm') command = `${command}.cmd`;
                    }

                    const workspaceRoot = this.context.getWorkspaceRoot();
                    if (workspaceRoot) {
                        args = args.map(arg => {
                            if (arg === '.' || arg === '${workspaceFolder}') return workspaceRoot;
                            return arg;
                        });
                    }

                    this.log(`   -> Starting [${serverId}]: ${command} ${args.join(' ')}`);
                    const transport = new StdioClientTransport({ command, args, env });
                    client = new Client({ name: "webmcp-gateway", version: "1.0.0" }, { capabilities: {} });
                    await client.connect(transport);
                }

                this.connectedClients.push({ id: serverId, client });
                const list = await client.listTools();
                this.log(`   ✅ [${serverId}] Connected. Loaded ${list.tools.length} tools.`);

                list.tools.forEach((tool) => {
                    if (this.toolRouter.has(tool.name)) {
                        this.log(`   ⚠️ Warning: Tool '${tool.name}' overridden by ${serverId}.`);
                    }
                    this.toolRouter.set(tool.name, { client, definition: tool, serverId });
                });

            } catch (err: any) {
                this.logger.error(`Failed to connect to [${serverId}]`, err);
            }
        }
    }

    async start(config: GatewayConfig): Promise<StartResult> {
        if (this.server) await this.stop();
        await this.connectToServers(config.mcpServers);

        if (!this.authToken) this.authToken = crypto.randomUUID();
        this.resetWatchdog();

        this.app = express();
        this.app.use(express.json());
        
        // CORS Middleware
        this.app.use(cors({
            origin: (origin, callback) => {
                if (!origin || origin.startsWith('chrome-extension://')) return callback(null, true);
                if (config.allowedOrigins.includes(origin)) return callback(null, true);
                if (origin.startsWith('http://127.0.0.1') || origin.startsWith('http://localhost')) return callback(null, true);
                this.log(`⛔ Blocked CORS request from: ${origin}`);
                callback(new Error('Not allowed by CORS'));
            }
        }));

        // Logging & Watchdog Middleware
        this.app.use((req, res, next) => {
            this.resetWatchdog();
            const start = Date.now();
            if (req.method !== 'OPTIONS') this.log(`🔔 [${req.method}] ${req.url}`);
            res.on('finish', () => {
                const duration = Date.now() - start;
                if (req.method !== 'OPTIONS') {
                    const icon = res.statusCode >= 400 ? '❌' : '   🏁';
                    this.log(`${icon} Status: ${res.statusCode} (${duration}ms)`);
                }
            });
            next();
        });

        // Auth Middleware
        this.app.use((req, res, next) => {
            if (req.path === '/bridge' || req.path === '/favicon.ico' || req.method === 'OPTIONS') return next();
            const clientToken = req.headers['x-webmcp-token'];
            if (!clientToken || clientToken !== this.authToken) {
                return res.status(403).json({
                    isError: true,
                    content: [{ type: 'text', text: "⛔ Forbidden: Invalid Security Token." }]
                });
            }
            next();
        });

        // Config Sync Routes
        this.app.get('/v1/config', async (req, res) => {
            this.log('📥 Config Sync: Pull requested');
            const savedConfig = await this.storage.get('mcp.browserConfig');
            res.json({ config: savedConfig || null });
        });

        this.app.post('/v1/config', async (req, res) => {
            const newConfig = req.body.config;
            if (newConfig) {
                await this.storage.update('mcp.browserConfig', newConfig);
                this.log('📤 Config Sync: Push received & saved');
                res.json({ success: true });
            } else {
                res.status(400).json({ error: "Missing config data" });
            }
        });

        // Bridge Page
        this.app.get('/bridge', (req, res) => {
            const target = req.query.target as string || 'https://chatgpt.com';
            const token = req.query.token as string;
            const port = this.server.address().port;
            this.log(`🌉 Bridge handshake requested.`);
            
            // Note: Returning simplified HTML for brevity, keeping core logic
            res.send(`
                <!DOCTYPE html>
                <html>
                <head><title>WebMCP Bridge</title></head>
                <body style="background:#1e1e1e;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:sans-serif;">
                    <h2>Connecting to WebMCP...</h2>
                    <div id="mcp-data" data-port="${port}" data-token="${token}" data-target="${target}" style="display:none;"></div>
                    <script>
                         setTimeout(() => {
                            const isInstalled = document.documentElement.getAttribute('data-extension-installed') === 'true';
                            if (!isInstalled) alert('Please install WebMCP Bridge Extension');
                        }, 1500);
                    </script>
                </body>
                </html>
            `);
        });

        // Tool Discovery
        this.app.get('/v1/tools', (req, res) => {
            const groups = this._generateGroupedTools();
            res.json({ groups });
        });

        // Tool Execution
        this.app.post('/v1/tools/call', async (req, res) => {
            const payload = req.body as ToolExecutionPayload;
            let { name, arguments: args } = payload;
            const toolStart = Date.now();

            // Local path resolution logic
            const localPathTools = [
                'read_file', 'read_text_file', 'write_file', 'edit_file',
                'list_directory', 'list_directory_with_sizes', 'search_files',
                'execute_command', 'run_in_terminal'
            ];
            const isLocalTool = localPathTools.includes(name) || name.startsWith('git_');
            const root = this.context.getWorkspaceRoot();

            if (isLocalTool && args && root) {
                const fixPath = (p: string) => (typeof p === 'string' && !path.isAbsolute(p)) ? path.join(root, p) : p;
                if (args.path) args.path = fixPath(args.path);
                if (args.cwd) args.cwd = fixPath(args.cwd);
                if (args.repo_path) args.repo_path = fixPath(args.repo_path);
            }

            // Internal Tools
            if (name === 'list_tools') {
                const result = this._generateGroupedTools();
                return res.json({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: false });
            }
            if (name === 'run_in_terminal') {
                 // This is platform specific, usually handled by client, but we might have a hook
                 // For now, we assume the core doesn't execute UI terminal commands directly unless injected
                 // TODO: Inject terminal handler via constructor if needed
                 return res.json({ content: [{ type: 'text', text: "run_in_terminal triggered" }], isError: false });
            }
            if (name === 'get_tool_definitions') {
                const requestedNames = args.tool_names as string[] || [];
                const definitions = [];
                for (const tName of requestedNames) {
                    if (this.toolRouter.has(tName)) definitions.push(this.toolRouter.get(tName)!.definition);
                    else if (tName === 'run_in_terminal') definitions.push(RUN_IN_TERMINAL_TOOL);
                    else if (tName === 'get_tool_definitions') definitions.push(GET_TOOL_DEFINITIONS_TOOL);
                }
                return res.json({ content: [{ type: 'text', text: JSON.stringify(definitions, null, 2) }], isError: false });
            }

            const route = this.toolRouter.get(name);
            if (!route) return res.status(404).json({ isError: true, content: [{ type: 'text', text: `Tool '${name}' not found.` }] });

            try {
                const result = await route.client.callTool({ name, arguments: args || {} });
                this.log(`   ✅ Finished: ${name} (${Date.now() - toolStart}ms)`);
                res.json(result);
            } catch (error: any) {
                this.logger.error(`Tool execution failed: ${name}`, error);
                res.status(500).json({ isError: true, content: [{ type: 'text', text: `Error: ${error.message}` }] });
            }
        });

        // Start Server
        return new Promise<StartResult>((resolve, reject) => {
            const tryListen = (currentPort: number, attempt: number) => {
                if (attempt > 20) return reject(new Error("No ports available"));
                
                this.server = this.app!.listen(currentPort, '127.0.0.1', () => {
                    this.log(`🌐 Gateway running on port ${currentPort}`);
                    if (this.onStatusChange) this.onStatusChange('online', currentPort);
                    resolve({ port: currentPort, token: this.authToken });
                });

                this.server.on('error', (e: any) => {
                    if (e.code === 'EADDRINUSE') {
                         if (config.preferredPort && currentPort === config.preferredPort && currentPort !== config.port) {
                            tryListen(config.port, 0);
                        } else {
                            tryListen(currentPort + 1, attempt + 1);
                        }
                    } else {
                        reject(e);
                    }
                });
            };
            tryListen(config.preferredPort && config.preferredPort !== config.port ? config.preferredPort : config.port, 0);
        });
    }

    async stop() {
        if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
        if (this.server) {
            this.server.close();
            this.server = null;
            this.log('🛑 Gateway server stopped.');
            if (this.onStatusChange) this.onStatusChange('offline');
        }
        this.connectedClients.forEach(c => { try { c.client.close(); } catch (e) { } });
        this.connectedClients = [];
    }
}
