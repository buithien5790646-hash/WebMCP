import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface WebMCPConfig {
    prompt: string;
    rules: string;
    train: string;
    error_hint: string;
    protected_tools?: string[];
}

export type ConfigScope = 'default' | 'global' | 'workspace';

export class ConfigManager {
    static readonly PREFIX = 'mcp.config.';

    /**
     * Get the merged configuration for a workspace, or just the specified scope
     */
    static async getConfig(context: vscode.ExtensionContext, workspaceId: string, scope: 'merged' | 'global' | 'workspace' = 'merged'): Promise<WebMCPConfig> {
        const defaults = await this.getDefaults(context);
        const global = this.getGlobalConfig(context);
        const workspace = this.getWorkspaceConfig(context, workspaceId);

        if (scope === 'global') {
            return {
                prompt: global.prompt ?? defaults.prompt,
                rules: global.rules ?? defaults.rules ?? '',
                train: global.train ?? defaults.train,
                error_hint: global.error_hint ?? defaults.error_hint,
                protected_tools: global.protected_tools ?? defaults.protected_tools,
            };
        }

        if (scope === 'workspace') {
            return {
                prompt: workspace.prompt ?? undefined as any,
                rules: workspace.rules ?? undefined as any,
                train: workspace.train ?? undefined as any,
                error_hint: workspace.error_hint ?? undefined as any,
                protected_tools: workspace.protected_tools ?? undefined as any,
            };
        }

        return {
            prompt: workspace.prompt ?? global.prompt ?? defaults.prompt,
            rules: workspace.rules ?? global.rules ?? defaults.rules ?? '',
            train: workspace.train ?? global.train ?? defaults.train,
            error_hint: workspace.error_hint ?? global.error_hint ?? defaults.error_hint,
            protected_tools: workspace.protected_tools ?? global.protected_tools ?? defaults.protected_tools,
        };
    }

    /**
     * Get the merged configuration for a workspace (Legacy wrapper)
     */
    static async getMergedConfig(context: vscode.ExtensionContext, workspaceId: string): Promise<WebMCPConfig> {
        return this.getConfig(context, workspaceId, 'merged');
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
        // Try shared assets (dev mode) or extension dist/assets (packaged mode)
        const devSharedPath = path.join(context.extensionPath, '..', 'shared', 'assets');
        const packagedAssetsPath = path.join(context.extensionPath, 'dist', 'assets');
        const legacyAssetsPath = path.join(context.extensionPath, 'assets');

        const readFile = (filename: string) => {
            const paths = [devSharedPath, packagedAssetsPath, legacyAssetsPath];
            for (const basePath of paths) {
                const p = path.join(basePath, filename);
                if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
            }
            return '';
        };

        const lang = vscode.env.language.startsWith('zh') ? 'zh' : 'en';

        return {
            prompt: readFile(lang === 'zh' ? 'prompt_zh.md' : 'prompt.md'),
            rules: '',
            train: readFile(lang === 'zh' ? 'train_zh.md' : 'train.md'),
            error_hint: readFile(lang === 'zh' ? 'error_hint_zh.md' : 'error_hint.md'),
            // protected_tools is undefined by default to indicate "uninitialized"
        };
    }
}
