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

    /**
     * Restore configuration for a workspace (deletes workspace config so it inherits global)
     */
    static async restoreDefault(workspaceId: string): Promise<void> {
        this.store.delete(`${this.PREFIX}${workspaceId}`);
    }

    private static getGlobalConfig(): Partial<WebMCPConfig> {
        return this.store.get(`${this.PREFIX}global`) as Partial<WebMCPConfig> || {};
    }

    private static getWorkspaceConfig(workspaceId: string): Partial<WebMCPConfig> {
        return this.store.get(`${this.PREFIX}${workspaceId}`) as Partial<WebMCPConfig> || {};
    }

    private static getDefaults(): WebMCPConfig {
        const isDev = !app.isPackaged;
        let assetsPath: string;
        
        if (!isDev) {
            assetsPath = path.join(process.resourcesPath, 'assets');
        } else {
            // Try local dist-electron/assets first (for built but not packaged)
            // Then fallback to shared/assets (for development)
            const localAssets = path.join(__dirname, 'assets');
            if (fs.existsSync(localAssets) && fs.readdirSync(localAssets).length > 0) {
                assetsPath = localAssets;
            } else {
                assetsPath = path.join(app.getAppPath(), '../shared/assets');
            }
        }

        const readFile = (filename: string) => {
            const p = path.join(assetsPath, filename);
            if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
            return '';
        };

        const locale = app.getLocale();
        const isEnglish = locale.startsWith('en');
        const lang = isEnglish ? 'en' : 'zh';

        const prompt = readFile(lang === 'zh' ? 'prompt_zh.md' : 'prompt.md');
        const train = readFile(lang === 'zh' ? 'train_zh.md' : 'train.md');
        const error_hint = readFile(lang === 'zh' ? 'error_hint_zh.md' : 'error_hint.md');

        return {
            prompt: prompt || (lang === 'zh' ? "你是一个强大的 AI 助手..." : "You are a helpful AI assistant..."),
            rules: "",
            train: train || (lang === 'zh' ? "训练数据指令..." : "Training data instructions..."),
            error_hint: error_hint || (lang === 'zh' ? "如果工具失败..." : "If a tool fails..."),
        };
    }
}
