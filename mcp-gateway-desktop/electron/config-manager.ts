import Store from 'electron-store';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { BaseConfigManager } from '@webmcp/shared';
import type { IMCPStorage, WebMCPConfig } from '@webmcp/shared';

class ElectronMCPStorage implements IMCPStorage {
    constructor(private store: Store) {}
    get<T>(key: string): T | undefined {
        return this.store.get(key) as T;
    }
    async update(key: string, value: any): Promise<void> {
        if (value === undefined) {
            this.store.delete(key);
        } else {
            this.store.set(key, value);
        }
    }
}

export class ConfigManager extends BaseConfigManager {
    private static instance: ConfigManager;
    private static store = new Store();

    private constructor() {
        const storage = new ElectronMCPStorage(ConfigManager.store);
        super(storage, storage); // Desktop uses same store for both
    }

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    /**
     * Get the merged configuration for a workspace, or just the specified scope
     */
    static async getConfig(workspaceId: string, scope: 'merged' | 'global' | 'workspace' = 'merged'): Promise<WebMCPConfig> {
        return this.getInstance().getConfig(workspaceId, scope, this.getDefaults());
    }

    /**
     * Save configuration to a specific scope
     */
    static async saveConfig(
        workspaceId: string,
        scope: 'global' | 'workspace',
        updates: Partial<WebMCPConfig>
    ): Promise<void> {
        return this.getInstance().saveConfig(workspaceId, scope, updates);
    }

    /**
     * Reset configuration for a scope
     */
    static async resetConfig(workspaceId: string, scope: 'global' | 'workspace'): Promise<void> {
        return this.getInstance().resetConfig(workspaceId, scope);
    }

    /**
     * Restore configuration for a workspace (deletes workspace config so it inherits global)
     */
    static async restoreDefault(workspaceId: string): Promise<void> {
        this.store.delete(`${this.PREFIX}${workspaceId}`);
    }

    static getDefaults(): WebMCPConfig {
        const isDev = !app.isPackaged;
        let assetsPath: string;
        
        if (!isDev) {
            assetsPath = path.join(process.resourcesPath, 'assets');
        } else {
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
