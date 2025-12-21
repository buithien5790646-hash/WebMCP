import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BaseConfigManager, IMCPStorage, WebMCPConfig } from '@webmcp/shared';

class VSCodeMCPStorage implements IMCPStorage {
    constructor(private state: vscode.Memento) {}
    get<T>(key: string): T | undefined {
        return this.state.get<T>(key);
    }
    async update(key: string, value: any): Promise<void> {
        await this.state.update(key, value);
    }
}

export class ConfigManager extends BaseConfigManager {
    private static instance: ConfigManager;

    private constructor(context: vscode.ExtensionContext) {
        super(
            new VSCodeMCPStorage(context.workspaceState),
            new VSCodeMCPStorage(context.globalState)
        );
    }

    static getInstance(context: vscode.ExtensionContext): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager(context);
        }
        return ConfigManager.instance;
    }

    /**
     * Get the merged configuration for a workspace, or just the specified scope
     */
    static async getConfig(context: vscode.ExtensionContext, workspaceId: string, scope: 'merged' | 'global' | 'workspace' = 'merged'): Promise<WebMCPConfig> {
        return this.getInstance(context).getConfig(workspaceId, scope, await this.getDefaults(context));
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
        return this.getInstance(context).saveConfig(workspaceId, scope, updates);
    }

    /**
     * Reset configuration for a scope
     */
    static async resetConfig(context: vscode.ExtensionContext, workspaceId: string, scope: 'global' | 'workspace'): Promise<void> {
        return this.getInstance(context).resetConfig(workspaceId, scope);
    }

    static async getDefaults(context: vscode.ExtensionContext): Promise<WebMCPConfig> {
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
        };
    }
}
