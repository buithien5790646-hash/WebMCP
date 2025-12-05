import * as vscode from 'vscode';
import { GatewayManager } from './gateway';
import { exec } from 'child_process';
import * as os from 'os';

let manager: GatewayManager;
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;
let currentPort: number | null = null;

export async function activate(context: vscode.ExtensionContext) {
    // 1. 创建输出面板
    outputChannel = vscode.window.createOutputChannel("MCP Gateway");
    outputChannel.show(true);
    outputChannel.appendLine("🚀 MCP Gateway Extension Activating...");

    // 2. 初始化管理器
    manager = new GatewayManager(outputChannel, context.extensionPath);

    // 3. [修复] 先创建状态栏对象，再启动服务
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'mcp-gateway.connect';
    context.subscriptions.push(statusBarItem);

    // 4. 启动服务逻辑
    const startService = async () => {
        const config = vscode.workspace.getConfiguration('mcpGateway');
        const portConfig = config.get<number>('port') || 34567;
        const allowedExtensionIds = config.get<string[]>('allowedExtensionIds') || [];
        const mcpServers = config.get<any>('servers') || {};
        const lastUsedPort = context.workspaceState.get<number>('mcp.lastPort');

        try {
            currentPort = await manager.start({
                port: portConfig,
                preferredPort: lastUsedPort,
                allowedExtensionIds,
                mcpServers
            });

            if (currentPort !== lastUsedPort) {
                await context.workspaceState.update('mcp.lastPort', currentPort);
            }

            // 服务启动成功，更新状态栏
            updateStatusBar(true, currentPort);

        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to start MCP Gateway: ${e.message}`);
            updateStatusBar(false);
        }
    };

    // 5. 立即启动
    await startService();

    // 6. 注册命令：连接 AI
    context.subscriptions.push(vscode.commands.registerCommand('mcp-gateway.connect', async () => {
        if (!currentPort) {
            vscode.window.showErrorMessage("MCP Gateway is not running.");
            return;
        }

        const items = [
            { label: '$(globe) Open ChatGPT', description: 'chatgpt.com', target: 'https://chatgpt.com' },
            { label: '$(globe) Open Gemini', description: 'gemini.google.com', target: 'https://gemini.google.com' },
            { label: '$(globe) Open DeepSeek', description: 'chat.deepseek.com', target: 'https://chat.deepseek.com' },
            // --- 新增配置和重启选项 ---
            { label: '$(settings-gear) Configure Gateway', description: 'Quick access to MCP Gateway settings', action: 'settings' },
            { label: '$(refresh) Restart Server', description: 'Restart local gateway', action: 'restart' }
        ];

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select AI Platform or Action',
            title: `WebMCP (Port: ${currentPort})`
        });

        if (!selection) { return; }

        // --- 处理新增的配置选项 ---
        if (selection.action === 'settings') {
            // 使用 extension ID 直接打开设置页
            vscode.commands.executeCommand('workbench.action.openSettings', '@ext:mcp-user.mcp-gateway-vscode');
            return;
        }

        if (selection.action === 'restart') {
            outputChannel.appendLine("🔄 Manual restart triggered.");
            await manager.stop(); // 确保旧服务被停止
            await startService();
            vscode.window.showInformationMessage("Server Restarted");
            return;
        }

        // 生成桥接链接
        const bridgeUrl = `http://127.0.0.1:${currentPort}/bridge?target=${encodeURIComponent(selection.target!)}`;

        // 打开浏览器
        const browserChoice = vscode.workspace.getConfiguration('mcpGateway').get<string>('browser') || 'default';
        openBrowser(bridgeUrl, browserChoice);
    }));

    // 监听配置变化
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('mcpGateway')) {
            outputChannel.appendLine("⚙️ Configuration changed, restarting...");
            await startService();
        }
    }));
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
    } else { // Linux fallback
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

export function deactivate() {
    if (manager) {
        manager.stop();
    }
}