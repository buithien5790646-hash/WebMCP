import * as vscode from 'vscode';
import { GatewayManager } from './gateway';
import { exec } from 'child_process';
import * as os from 'os';

// 定义统一的 QuickPickItem 接口，解决类型推断报错
interface ActionItem extends vscode.QuickPickItem {
    target?: string;
    action?: string;
    value?: string;
}

let manager: GatewayManager;
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;
let currentPort: number | null = null;
let currentToken: string | null = null;

export async function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel("MCP Gateway");
    // outputChannel.show(true); // 静默启动，不自动弹出面板
    outputChannel.appendLine("🚀 MCP Gateway Extension Activating...");

    manager = new GatewayManager(outputChannel, context.extensionPath);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'mcp-gateway.connect';
    context.subscriptions.push(statusBarItem);

    const startService = async () => {
        const config = vscode.workspace.getConfiguration('mcpGateway');
        const portConfig = config.get<number>('port') || 34567;
        const mcpServers = config.get<any>('servers') || {};
        const lastUsedPort = context.workspaceState.get<number>('mcp.lastPort');

        try {
            const result = await manager.start({
                port: portConfig,
                preferredPort: lastUsedPort,
                mcpServers
            });

            currentPort = result.port;
            currentToken = result.token;

            if (currentPort !== lastUsedPort) {
                await context.workspaceState.update('mcp.lastPort', currentPort);
            }

            updateStatusBar(true, currentPort);

        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to start MCP Gateway: ${e.message}`);
            updateStatusBar(false);
        }
    };

    await startService();

    context.subscriptions.push(vscode.commands.registerCommand('mcp-gateway.connect', async () => {
        if (!currentPort || !currentToken) {
            vscode.window.showErrorMessage("MCP Gateway is not running.");
            return;
        }

        // 使用明确的类型 ActionItem
        const aiOptions: ActionItem[] = [
            { label: '$(globe) Open ChatGPT', description: 'chatgpt.com', target: 'https://chatgpt.com' },
            { label: '$(globe) Open Gemini', description: 'gemini.google.com', target: 'https://gemini.google.com' },
            { label: '$(globe) Open DeepSeek', description: 'chat.deepseek.com', target: 'https://chat.deepseek.com' },
        ];

        const items: ActionItem[] = [
            ...aiOptions,
            { label: '$(run) Custom Launch...', description: 'Select AI and Browser manually', action: 'custom' },
            { label: '$(output) View Logs', description: 'Show MCP Gateway output panel', action: 'showLogs' },
            { label: '$(settings-gear) Configure Gateway', description: 'Quick access to MCP Gateway settings', action: 'settings' },
            { label: '$(refresh) Restart Server', description: 'Restart local gateway', action: 'restart' }
        ];

        const selection = await vscode.window.showQuickPick<ActionItem>(items, {
            placeHolder: 'Select AI Platform or Action',
            title: `WebMCP (Port: ${currentPort})`
        });

        if (!selection) { return; }

        // 0. 查看日志
        if (selection.action === 'showLogs') {
            outputChannel.show();
            return;
        }

        // 1. 设置
        if (selection.action === 'settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'mcpGateway');
            return;
        }

        // 2. 重启
        if (selection.action === 'restart') {
            outputChannel.appendLine("🔄 Manual restart triggered.");
            await manager.stop();
            await startService();
            vscode.window.showInformationMessage("Server Restarted");
            return;
        }

        // 3. 自定义启动
        if (selection.action === 'custom') {
            const aiSelection = await vscode.window.showQuickPick<ActionItem>(aiOptions, {
                placeHolder: 'Step 1: Select AI Platform'
            });
            // 修复 ESLint: 必须加花括号
            if (!aiSelection) { return; }

            const browserOptions: ActionItem[] = [
                { label: '$(browser) Google Chrome', value: 'chrome' },
                { label: '$(browser) Microsoft Edge', value: 'edge' },
                { label: '$(terminal) System Default', value: 'default' }
            ];
            const browserSelection = await vscode.window.showQuickPick<ActionItem>(browserOptions, {
                placeHolder: `Step 2: Open ${aiSelection.label.replace('$(globe) ', '')} in...`
            });
            // 修复 ESLint: 必须加花括号
            if (!browserSelection) { return; }

            launchBridge(aiSelection.target!, browserSelection.value!);
            return;
        }

        // 4. 默认启动 (智能匹配配置)
        if (selection.target) {
            launchBridge(selection.target, 'auto');
        }
    }));

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('mcpGateway.port') || e.affectsConfiguration('mcpGateway.servers')) {
            outputChannel.appendLine("⚙️ Server configuration changed, restarting...");
            await startService();
        }
    }));
}

function launchBridge(targetUrl: string, browserMode: string) {
    const bridgeUrl = `http://127.0.0.1:${currentPort}/bridge?token=${currentToken}&target=${encodeURIComponent(targetUrl)}`;
    
    const config = vscode.workspace.getConfiguration('mcpGateway');
    let finalBrowser = config.get<string>('browser') || 'default';

    if (browserMode === 'auto') {
        const rules = config.get<Record<string, string>>('browserRules') || {};
        for (const [key, browser] of Object.entries(rules)) {
            if (targetUrl.includes(key)) {
                finalBrowser = browser;
                break;
            }
        }
    } else {
        finalBrowser = browserMode;
    }

    openBrowser(bridgeUrl, finalBrowser);
}

function updateStatusBar(online: boolean, port?: number) {
    if (online && port) {
        statusBarItem.text = `$(rocket) WebMCP: ${port}`;
        statusBarItem.tooltip = "Click to connect AI";
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = `$(alert) WebMCP: Offline`;
        statusBarItem.tooltip = "Server failed to start";
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
    statusBarItem.show();
}

function openBrowser(url: string, browserType: string) {
    const platform = os.platform();
    let command = '';

    if (browserType === 'default') {
        vscode.env.openExternal(vscode.Uri.parse(url));
        return;
    }

    if (platform === 'win32') {
        if (browserType === 'chrome') {
            command = `start chrome "${url}"`;
        } else if (browserType === 'edge') {
            command = `start msedge "${url}"`;
        }
    } else if (platform === 'darwin') {
        if (browserType === 'chrome') {
            command = `open -a "Google Chrome" "${url}"`;
        }
        else if (browserType === 'edge') {
            command = `open -a "Microsoft Edge" "${url}"`;
        }
    } else {
        if (browserType === 'chrome') {
            command = `google-chrome "${url}"`;
        } else {
            command = `xdg-open "${url}"`;
        }
    }

    if (command) {
        exec(command, (err) => {
            if (err) {
                vscode.window.showErrorMessage(`Failed to open browser: ${err.message}`);
            }
        });
    } else {
        vscode.env.openExternal(vscode.Uri.parse(url));
    }
}