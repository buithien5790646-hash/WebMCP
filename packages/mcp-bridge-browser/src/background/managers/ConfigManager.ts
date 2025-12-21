import { browserService, getLocal, setLocal, getSync, setSync, apiClient } from "@/services";
import { GatewayConfigSchema } from "@/types/schemas";

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
    const scriptPatterns = (manifest.content_scripts || []).flatMap((cs) => cs.matches || []);
    const allPatterns = [...new Set([...hostPatterns, ...scriptPatterns])];

    return allPatterns.some((pattern) => {
      const base = pattern.replace(/\*$/, "");
      return url.startsWith(base) || url === base.replace(/\/$/, "");
    });
  }

  /**
   * Push current config to the Gateway
   */
  async pushConfigToGateway(workspaceId?: string) {
    try {
      if (!apiClient.isConfigured()) return false;

      const prefix = workspaceId ? `${workspaceId}_` : "";
      const lang = navigator.language.startsWith("zh") ? "zh" : "en";

      // 1. Get current data from extension storage
      const syncKeysRaw = ["protected_tools", "autoSend"];
      const syncKeys = syncKeysRaw.map((k) => `${prefix}${k}`);
      const syncDataPrefixed = await getSync(syncKeys as any);

      const localKeysRaw = [
        "prompt_en",
        "prompt_zh",
        "train_en",
        "train_zh",
        "error_en",
        "error_zh",
        "user_rules",
      ];
      const localKeys = localKeysRaw.map((k) => `${prefix}${k}`);
      const localDataPrefixed = await getLocal(localKeys as any);

      // 2. Map to Gateway format (flattened)
      const gatewayConfig: Record<string, any> = {
        prompt: localDataPrefixed[`${prefix}prompt_${lang}`],
        rules: localDataPrefixed[`${prefix}user_rules`],
        train: localDataPrefixed[`${prefix}train_${lang}`],
        error_hint: localDataPrefixed[`${prefix}error_${lang}`],
        protected_tools: syncDataPrefixed[`${prefix}protected_tools`],
      };

      // 3. Also include the full sync/local structure for extension-native support if needed
      // But primarily Gateway expects the flattened format.
      const fullPayload = {
        ...gatewayConfig,
        version: 1,
        timestamp: new Date().toISOString(),
        sync: {
          protected_tools: syncDataPrefixed[`${prefix}protected_tools`],
          autoSend: syncDataPrefixed[`${prefix}autoSend`],
        },
        local: {
          prompt_en: localDataPrefixed[`${prefix}prompt_en`],
          prompt_zh: localDataPrefixed[`${prefix}prompt_zh`],
          train_en: localDataPrefixed[`${prefix}train_en`],
          train_zh: localDataPrefixed[`${prefix}train_zh`],
          error_en: localDataPrefixed[`${prefix}error_en`],
          error_zh: localDataPrefixed[`${prefix}error_zh`],
          user_rules: localDataPrefixed[`${prefix}user_rules`],
        },
      };

      await apiClient.pushConfig(fullPayload, workspaceId);
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

        // If workspaceId is provided, we prefix keys to isolate storage
        const prefix = workspaceId ? `${workspaceId}_` : "";

        if (sync) {
          const syncToSet: Record<string, any> = {};
          Object.entries(sync).forEach(([k, v]) => {
            syncToSet[`${prefix}${k}`] = v;
          });
          await setSync(syncToSet as any);
        }

        if (local) {
          const localToSet: Record<string, string> = {};
          const keys = [
            "prompt_en",
            "prompt_zh",
            "train_en",
            "train_zh",
            "error_en",
            "error_zh",
            "user_rules",
          ];
          keys.forEach((k) => {
            if (local[k]) localToSet[`${prefix}${k}`] = local[k];
          });
          if (Object.keys(localToSet).length > 0) {
            await setLocal(localToSet as any);
          }
        }
        return config;
      }

      // 2. Handle VS Code/Desktop Gateway Config Format (prompt/rules/train/error_hint/protected_tools)
      const prefix = workspaceId ? `${workspaceId}_` : "";
      const lang = navigator.language.startsWith("zh") ? "zh" : "en";
      const localToSet: Record<string, string> = {};

      if (config.prompt !== undefined) localToSet[`${prefix}prompt_${lang}`] = config.prompt;
      if (config.rules !== undefined) localToSet[`${prefix}user_rules`] = config.rules;
      if (config.train !== undefined) localToSet[`${prefix}train_${lang}`] = config.train;
      if (config.error_hint !== undefined) localToSet[`${prefix}error_${lang}`] = config.error_hint;

      if (Object.keys(localToSet).length > 0) {
        await setLocal(localToSet as any);
      }

      if (config.protected_tools !== undefined) {
        await setSync({ [`${prefix}protected_tools`]: config.protected_tools } as any);
      }

      return config;
    } catch (e) {
      console.error("[WebMCP] Config sync failed:", e);
      return null;
    }
  }
}

export const configManager = new ConfigManager();
