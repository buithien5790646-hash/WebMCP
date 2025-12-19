import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface WebMCPConfig {
    prompt: string;
    rules: string;
    train: string;
    error_hint: string;
    summary_tools: string[];
    protected_tools: string[];
}

export type ConfigScope = 'default' | 'global' | 'workspace';

export class ConfigManager {
    static readonly PREFIX = 'mcp.config.';

    /**
     * Get the merged configuration for a workspace
     */
    static async getMergedConfig(context: vscode.ExtensionContext, workspaceId: string): Promise<WebMCPConfig> {
        const defaults = await this.getDefaults(context);
        const global = this.getGlobalConfig(context);
        const workspace = this.getWorkspaceConfig(context, workspaceId);

        return {
            prompt: workspace.prompt ?? global.prompt ?? defaults.prompt,
            rules: workspace.rules ?? global.rules ?? defaults.rules ?? '',
            train: workspace.train ?? global.train ?? defaults.train,
            error_hint: workspace.error_hint ?? global.error_hint ?? defaults.error_hint,
            summary_tools: workspace.summary_tools ?? global.summary_tools ?? defaults.summary_tools,
            protected_tools: workspace.protected_tools ?? global.protected_tools ?? defaults.protected_tools,
        };
    }

    /**
     * Save configuration to a specific scope
     */
    static async saveConfig(
        context: vscode.ExtensionContext,
        workspaceId: string,
        scope: 'global' | 'workspace',
        updates: Partial<WebMCPConfig>
    ): Promise<void> {
        const state = scope === 'global' ? context.globalState : context.workspaceState;
        const key = scope === 'global' ? `${this.PREFIX}global` : `${this.PREFIX}${workspaceId}`;

        const current = state.get<Partial<WebMCPConfig>>(key) || {};
        const next = { ...current, ...updates };

        await state.update(key, next);
    }

    /**
     * Reset configuration for a scope
     */
    static async resetConfig(context: vscode.ExtensionContext, workspaceId: string, scope: 'global' | 'workspace'): Promise<void> {
        const state = scope === 'global' ? context.globalState : context.workspaceState;
        const key = scope === 'global' ? `${this.PREFIX}global` : `${this.PREFIX}${workspaceId}`;
        await state.update(key, undefined);
    }

    private static getGlobalConfig(context: vscode.ExtensionContext): Partial<WebMCPConfig> {
        return context.globalState.get<Partial<WebMCPConfig>>(`${this.PREFIX}global`) || {};
    }

    private static getWorkspaceConfig(context: vscode.ExtensionContext, workspaceId: string): Partial<WebMCPConfig> {
        // Even if we have multiple projects, we use workspaceState which is already isolated by VS Code
        // But for safety and desktop app compatibility, we still key it by workspaceId
        return context.workspaceState.get<Partial<WebMCPConfig>>(`${this.PREFIX}${workspaceId}`) || {};
    }

    private static async getDefaults(context: vscode.ExtensionContext): Promise<WebMCPConfig> {
        const assetsPath = path.join(context.extensionPath, 'assets');

        const readFile = (filename: string) => {
            const p = path.join(assetsPath, filename);
            if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
            return '';
        };

        const lang = vscode.env.language.startsWith('zh') ? 'zh' : 'en';

        return {
            prompt: readFile(lang === 'zh' ? 'prompt_zh.md' : 'prompt.md'),
            rules: '',
            train: readFile(lang === 'zh' ? 'train_zh.md' : 'train.md'),
            error_hint: readFile(lang === 'zh' ? 'error_hint_zh.md' : 'error_hint.md'),
            summary_tools: ['list_tools', 'read_file', 'ls', 'search_repo'], // Example defaults
            protected_tools: [], // By default, all tools are protected if not in authorized list
        };
    }
}
