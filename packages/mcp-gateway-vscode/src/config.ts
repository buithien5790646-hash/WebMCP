import * as vscode from "vscode";
import { BaseConfigManager, IMCPStorage, WebMCPConfig, ASSETS } from "@webmcp/shared";

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
    super(new VSCodeMCPStorage(context.workspaceState), new VSCodeMCPStorage(context.globalState));
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
  static async getConfig(
    context: vscode.ExtensionContext,
    workspaceId: string,
    scope: "merged" | "global" | "workspace" = "merged"
  ): Promise<WebMCPConfig> {
    return this.getInstance(context).getConfig(workspaceId, scope, this.getDefaults());
  }

  /**
   * Save configuration to a specific scope
   */
  static async saveConfig(
    context: vscode.ExtensionContext,
    workspaceId: string,
    scope: "global" | "workspace",
    updates: Partial<WebMCPConfig>
  ): Promise<void> {
    return this.getInstance(context).saveConfig(workspaceId, scope, updates);
  }

  /**
   * Reset configuration for a scope
   */
  static async resetConfig(
    context: vscode.ExtensionContext,
    workspaceId: string,
    scope: "global" | "workspace"
  ): Promise<void> {
    return this.getInstance(context).resetConfig(workspaceId, scope);
  }

  static getDefaults(): WebMCPConfig {
    const lang = vscode.env.language.startsWith("zh") ? "zh" : "en";
    const assets = lang === "zh" ? ASSETS.zh : ASSETS.en;

    return {
      prompt: assets.prompt,
      rules: "",
      train: assets.train,
      error_hint: assets.error_hint,
    };
  }
}
