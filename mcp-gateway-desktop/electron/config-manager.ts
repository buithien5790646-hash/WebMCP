import Store from 'electron-store';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

export interface WebMCPConfig {
    prompt: string;
    rules: string;
    train: string;
    error_hint: string;
    protected_tools?: string[];
}

export class ConfigManager {
    private static readonly PREFIX = 'mcp.config.';
    private static store = new Store();

    /**
     * Get the merged configuration for a workspace, or just the specified scope
     */
    static async getConfig(workspaceId: string, scope: 'merged' | 'global' | 'workspace' = 'merged'): Promise<WebMCPConfig> {
        const defaults = this.getDefaults();
        const global = this.getGlobalConfig();
        const workspace = this.getWorkspaceConfig(workspaceId);

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
     * Save configuration to a specific scope
     */
    static async saveConfig(
        workspaceId: string,
        scope: 'global' | 'workspace',
        updates: Partial<WebMCPConfig>
    ): Promise<void> {
        const key = scope === 'global' ? `${this.PREFIX}global` : `${this.PREFIX}${workspaceId}`;
        const current = this.store.get(key) as Partial<WebMCPConfig> || {};
        const next = { ...current, ...updates };
        this.store.set(key, next);
    }

    /**
     * Reset configuration for a scope
     */
    static async resetConfig(workspaceId: string, scope: 'global' | 'workspace'): Promise<void> {
        const key = scope === 'global' ? `${this.PREFIX}global` : `${this.PREFIX}${workspaceId}`;
        this.store.delete(key);
    }

    private static getGlobalConfig(): Partial<WebMCPConfig> {
        return this.store.get(`${this.PREFIX}global`) as Partial<WebMCPConfig> || {};
    }

    private static getWorkspaceConfig(workspaceId: string): Partial<WebMCPConfig> {
        return this.store.get(`${this.PREFIX}${workspaceId}`) as Partial<WebMCPConfig> || {};
    }

    private static getDefaults(): WebMCPConfig {
        const isDev = !app.isPackaged;
        const assetsPath = isDev 
            ? path.join(__dirname, '../../shared/assets')
            : path.join(process.resourcesPath, 'assets');

        const readFile = (filename: string) => {
            const p = path.join(assetsPath, filename);
            if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
            return '';
        };

        const locale = app.getLocale();
        const lang = locale.startsWith('zh') ? 'zh' : 'en';

        return {
            prompt: readFile(lang === 'zh' ? 'prompt_zh.md' : 'prompt.md') || "You are a helpful AI assistant with access to local tools...",
            rules: "",
            train: readFile(lang === 'zh' ? 'train_zh.md' : 'train.md') || "Training data instructions...",
            error_hint: readFile(lang === 'zh' ? 'error_hint_zh.md' : 'error_hint.md') || "If a tool fails, try to explain why...",
        };
    }
}
