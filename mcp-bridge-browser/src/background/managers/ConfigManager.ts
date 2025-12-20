import { browserService, getLocal, setLocal, getSync, setSync, apiClient, ErrorHandler } from '@/services';
import { GatewayConfigSchema } from '@/types/schemas';

export class ConfigManager {
    /**
     * Initialize extension storage on first install or update
     */
    async initializeStorage() {
        // 1. Initialize user settings
        const syncKeys = ["autoSend", "protected_tools"];
        const existingSync = await getSync(syncKeys as any);
        const syncToSet: Record<string, any> = {};

        if (existingSync.autoSend === undefined) syncToSet.autoSend = true;

        if (Object.keys(syncToSet).length > 0) {
            await setSync(syncToSet as any);
        }
    }

    /**
     * Check if a URL is allowed based on manifest permissions
     */
    isUrlAllowed(url: string | undefined): boolean {
        if (!url) return false;
        const manifest = browserService.getManifest();

        const hostPatterns = manifest.host_permissions || [];
        const scriptPatterns = (manifest.content_scripts || []).flatMap(
            (cs) => cs.matches || []
        );
        const allPatterns = [...new Set([...hostPatterns, ...scriptPatterns])];

        return allPatterns.some((pattern) => {
            const base = pattern.replace(/\*$/, "");
            return url.startsWith(base) || url === base.replace(/\/$/, "");
        });
    }

    /**
     * Push current config to the Gateway
     */
    async pushConfigToGateway() {
        try {
            if (!apiClient.isConfigured()) return false;

            const syncData = await getSync(["protected_tools", "autoSend"] as any);
            const localKeys = ["prompt_en", "prompt_zh", "train_en", "train_zh", "error_en", "error_zh", "user_rules"];
            const localData = await getLocal(localKeys as any);

            const fullConfig = {
                version: 1,
                timestamp: new Date().toISOString(),
                sync: syncData,
                local: localData
            };

            await apiClient.pushConfig(fullConfig);
            return true;
        } catch (e) {
            console.error("[WebMCP] Failed to push config:", e);
            return false;
        }
    }

    /**
     * Pull and apply config from the Gateway
     */
    async syncConfigFromGateway(workspaceId?: string) {
        try {
            if (!apiClient.isConfigured()) return null;

            const config = await apiClient.pullConfig(workspaceId);
            if (!config) return null;

            // 1. Handle Extension-Native Config Format (version/sync/local)
            const parse = GatewayConfigSchema.safeParse(config);
            if (parse.success) {
                const { sync, local } = parse.data;
                if (sync) await setSync(sync);
                if (local) {
                    const safeLocal: Record<string, string> = {};
                    const keys = ["prompt_en", "prompt_zh", "train_en", "train_zh", "error_en", "error_zh", "user_rules"];
                    keys.forEach(k => {
                        if (local[k]) safeLocal[k] = local[k];
                    });
                    if (Object.keys(safeLocal).length > 0) {
                        await setLocal(safeLocal as any);
                    }
                }
                return config;
            }

            // 2. Handle VS Code Gateway Config Format (prompt/rules/train/error_hint)
             // This format is simplified and depends on the Gateway's current language
             if (config.prompt !== undefined) {
                 const lang = navigator.language.startsWith('zh') ? 'zh' : 'en';
                 const localToSet: Record<string, string> = {
                    [`prompt_${lang}`]: config.prompt,
                    [`train_${lang}`]: config.train,
                    [`error_${lang}`]: config.error_hint,
                    "user_rules": config.rules || ""
                };
                await setLocal(localToSet as any);

                if (config.protected_tools) {
                    await setSync({ protected_tools: config.protected_tools });
                }
            }

            return config;
        } catch (e) {
            ErrorHandler.report(e, "ConfigManager.syncConfigFromGateway", true);
            return null;
        }
    }
}

export const configManager = new ConfigManager();
