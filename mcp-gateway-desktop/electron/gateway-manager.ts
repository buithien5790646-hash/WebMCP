import { BaseGatewayManager } from '@webmcp/shared';
import type { GatewayHooks, WebMCPConfig } from '@webmcp/shared';
import { ConfigManager } from './config-manager';

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

export class GatewayManager extends BaseGatewayManager {
    constructor(logFn: (msg: string) => void, workspaceId?: string) {
        const hooks: GatewayHooks = {
            log: (msg: string) => {
                const now = new Date();
                const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                logFn(`[${time}] ${msg}`);
            },
            error: (msg: string, err?: any) => {
                const now = new Date();
                const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                logFn(`[${time}] ❌ ${msg} ${err ? (err.message || JSON.stringify(err)) : ''}`);
            },
            getConfig: (workspaceId: string, scope: 'merged' | 'global' | 'workspace') => {
                return ConfigManager.getConfig(workspaceId, scope);
            },
            saveConfig: (workspaceId: string, scope: 'global' | 'workspace', updates: Partial<WebMCPConfig>) => {
                return ConfigManager.saveConfig(workspaceId, scope, updates);
            },
            resetConfig: (workspaceId: string, scope: 'global' | 'workspace') => {
                return ConfigManager.resetConfig(workspaceId, scope);
            },
            restoreDefaultConfig: (workspaceId: string) => {
                return ConfigManager.restoreDefault(workspaceId);
            },
            getInternalTools: () => [RUN_IN_TERMINAL_TOOL],
            handleInternalToolCall: async (name: string, _args: any) => {
                if (name === 'run_in_terminal') {
                    // In Desktop, we might want to implement this using child_process or just log it for now
                    // Actually, the original implementation didn't have a handler for run_in_terminal in tools/call
                    // It was just listed in tools.
                    return { content: [{ type: 'text', text: 'Command sent to terminal (mock)' }] };
                }
                return undefined;
            }
        };
        super(hooks, workspaceId);
    }
}
