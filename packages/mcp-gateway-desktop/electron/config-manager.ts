import Store from "electron-store";
import { app } from "electron";
import { BaseConfigManager, ASSETS } from "@webmcp/shared";
import type { IMCPStorage, WebMCPConfig } from "@webmcp/shared";

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
  static async getConfig(
    workspaceId: string,
    scope: "merged" | "global" | "workspace" = "merged"
  ): Promise<WebMCPConfig> {
    return this.getInstance().getConfig(workspaceId, scope, this.getDefaults());
  }

  /**
   * Save configuration to a specific scope
   */
  static async saveConfig(
    workspaceId: string,
    scope: "global" | "workspace",
    updates: Partial<WebMCPConfig>
  ): Promise<void> {
    return this.getInstance().saveConfig(workspaceId, scope, updates);
  }

  /**
   * Reset configuration for a scope
   */
  static async resetConfig(workspaceId: string, scope: "global" | "workspace"): Promise<void> {
    return this.getInstance().resetConfig(workspaceId, scope);
  }

  /**
   * Restore configuration for a workspace (deletes workspace config so it inherits global)
   */
  static async restoreDefault(workspaceId: string): Promise<void> {
    this.store.delete(`${this.PREFIX}${workspaceId}`);
  }

  static getDefaults(): WebMCPConfig {
    const locale = app.getLocale();
    const isZh = locale.startsWith("zh");
    const assets = isZh ? ASSETS.zh : ASSETS.en;

    return {
      prompt: assets.prompt,
      rules: "",
      train: assets.train,
      error_hint: assets.error_hint,
    };
  }
}
