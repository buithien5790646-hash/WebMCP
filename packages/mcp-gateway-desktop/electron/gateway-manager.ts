import { BaseGatewayManager } from "@webmcp/shared";
import type { GatewayHooks, WebMCPConfig } from "@webmcp/shared";
import { ConfigManager } from "./config-manager";

export class GatewayManager extends BaseGatewayManager {
  constructor(logFn: (msg: string) => void, workspaceId?: string) {
    const hooks: GatewayHooks = {
      log: (msg: string) => {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
        logFn(`[${time}] ${msg}`);
      },
      error: (msg: string, err?: any) => {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
        logFn(`[${time}] ❌ ${msg} ${err ? err.message || JSON.stringify(err) : ""}`);
      },
      getConfig: (workspaceId: string, scope: "merged" | "global" | "workspace") => {
        return ConfigManager.getConfig(workspaceId, scope);
      },
      saveConfig: (
        workspaceId: string,
        scope: "global" | "workspace",
        updates: Partial<WebMCPConfig>
      ) => {
        return ConfigManager.saveConfig(workspaceId, scope, updates);
      },
      resetConfig: (workspaceId: string, scope: "global" | "workspace") => {
        return ConfigManager.resetConfig(workspaceId, scope);
      },
      restoreDefaultConfig: (workspaceId: string) => {
        return ConfigManager.restoreDefault(workspaceId);
      },
      getInternalTools: () => [],
      handleInternalToolCall: async (_name: string, _args: any) => {
        return undefined;
      },
    };
    super(hooks, workspaceId);
  }
}
