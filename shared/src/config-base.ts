import { IMCPStorage } from './storage';
import { WebMCPConfig } from './types';

export abstract class BaseConfigManager {
    static readonly PREFIX = 'mcp.config.';

    constructor(
        protected storage: IMCPStorage,
        protected globalStorage: IMCPStorage
    ) {}

    /**
     * Get the merged configuration for a workspace, or just the specified scope
     */
    async getConfig(
        workspaceId: string,
        scope: 'merged' | 'global' | 'workspace' = 'merged',
        defaults: WebMCPConfig
    ): Promise<WebMCPConfig> {
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
    async saveConfig(
        workspaceId: string,
        scope: 'global' | 'workspace',
        updates: Partial<WebMCPConfig>
    ): Promise<void> {
        const storage = scope === 'global' ? this.globalStorage : this.storage;
        const key = scope === 'global' ? `${BaseConfigManager.PREFIX}global` : `${BaseConfigManager.PREFIX}${workspaceId}`;

        const current = storage.get<Partial<WebMCPConfig>>(key) || {};
        const next = { ...current, ...updates };

        await storage.update(key, next);
    }

    /**
     * Reset configuration for a scope
     */
    async resetConfig(workspaceId: string, scope: 'global' | 'workspace'): Promise<void> {
        const storage = scope === 'global' ? this.globalStorage : this.storage;
        const key = scope === 'global' ? `${BaseConfigManager.PREFIX}global` : `${BaseConfigManager.PREFIX}${workspaceId}`;
        await storage.update(key, undefined);
    }

    protected getGlobalConfig(): Partial<WebMCPConfig> {
        return this.globalStorage.get<Partial<WebMCPConfig>>(`${BaseConfigManager.PREFIX}global`) || {};
    }

    protected getWorkspaceConfig(workspaceId: string): Partial<WebMCPConfig> {
        return this.storage.get<Partial<WebMCPConfig>>(`${BaseConfigManager.PREFIX}${workspaceId}`) || {};
    }
}
