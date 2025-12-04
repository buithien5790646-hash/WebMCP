import * as vscode from 'vscode';
import { GatewayManager } from './gateway';

let manager: GatewayManager;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
    // 1. 创建输出面板
    outputChannel = vscode.window.createOutputChannel("MCP Gateway");
    outputChannel.show(true);
    outputChannel.appendLine("🚀 MCP Gateway Extension Activating...");

    // 2. 初始化管理器
    manager = new GatewayManager(outputChannel, context.extensionPath);

    // 3. 启动服务的辅助函数
    const startService = async () => {
        const config = vscode.workspace.getConfiguration('mcpGateway');
        const port = config.get<number>('port') || 34567;
        const allowedExtensionIds = config.get<string[]>('allowedExtensionIds') || [];
        const mcpServers = config.get<any>('servers') || {};

        // === 核心修改：读取历史端口 ===
        const lastUsedPort = context.workspaceState.get<number>('mcp.lastPort');

        if (allowedExtensionIds.length === 0) {
            vscode.window.showWarningMessage("MCP Gateway: No Extension IDs configured. Only localhost connections will be allowed.");
        }

        try {
            // === 核心修改：传入首选端口并获取实际端口 ===
            const actualPort = await manager.start({
                port,
                preferredPort: lastUsedPort,
                allowedExtensionIds,
                mcpServers
            });

            // === 核心修改：保存成功使用的端口 ===
            if (actualPort !== lastUsedPort) {
                await context.workspaceState.update('mcp.lastPort', actualPort);
                // 如果端口变了（比如第一次从默认切到动态，或者动态切动态），提示一下
                // outputChannel.appendLine(`💾 Port preference updated: ${actualPort}`);
            }

        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to start MCP Gateway: ${e.message}`);
        }
    };

    // 4. 立即启动
    await startService();

    // 5. 注册重启命令
    let restartDisposable = vscode.commands.registerCommand('mcp-gateway-vscode.restart', async () => {
        outputChannel.appendLine("🔄 Manual restart triggered.");
        await startService();
        vscode.window.showInformationMessage("MCP Gateway Restarted");
    });

    // 6. 监听配置变化
    let configDisposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('mcpGateway')) {
            outputChannel.appendLine("⚙️ Configuration changed, restarting...");
            await startService();
        }
    });

    context.subscriptions.push(restartDisposable, configDisposable);
}

export function deactivate() {
    if (manager) {
        manager.stop();
    }
}
