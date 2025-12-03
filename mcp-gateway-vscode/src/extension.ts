import * as vscode from 'vscode';
import { GatewayManager } from './gateway';

let manager: GatewayManager;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
    // 1. 创建输出面板
    outputChannel = vscode.window.createOutputChannel("MCP Gateway");
    outputChannel.show(true);
    outputChannel.appendLine("🚀 MCP Gateway Extension Activating...");

    // 2. 初始化管理器 (关键修改：传入 context.extensionPath)
    manager = new GatewayManager(outputChannel, context.extensionPath);

    // 3. 启动服务的辅助函数
    const startService = async () => {
        const config = vscode.workspace.getConfiguration('mcpGateway');
        const port = config.get<number>('port') || 3000;
        const allowedExtensionId = config.get<string>('allowedExtensionId') || '';
        const mcpServers = config.get<any>('servers') || {};

        if (!allowedExtensionId) {
            vscode.window.showWarningMessage("MCP Gateway: No Extension ID configured. Please set 'mcpGateway.allowedExtensionId' in settings.");
        }

        try {
            await manager.start({
                port,
                allowedExtensionId,
                mcpServers
            });
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
