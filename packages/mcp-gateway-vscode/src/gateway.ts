import * as vscode from "vscode";
import { BaseGatewayManager, GatewayHooks, WebMCPConfig } from "@webmcp/shared";
import { ConfigManager } from "./config";

const RUN_IN_TERMINAL_TOOL = {
  name: "run_in_terminal",
  description:
    "Execute a command in the VS Code integrated terminal. Use this for long-running processes (e.g., 'npm start', 'python server.py') or when you want the user to see the output in real-time. Returns immediately after sending the command.",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string", description: "The command to execute" },
      auto_focus: {
        type: "boolean",
        description: "Focus the terminal after sending the command",
        default: true,
      },
    },
    required: ["command"],
  },
};

export class GatewayManager extends BaseGatewayManager {
  private watchdogTimer: NodeJS.Timeout | null = null;
  private readonly WATCHDOG_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor(
    outputChannel: vscode.OutputChannel,
    _extensionPath: string,
    private context: vscode.ExtensionContext,
    private onAutoStop?: () => void
  ) {
    const hooks: GatewayHooks = {
      log: (msg: string) => {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
        outputChannel.appendLine(`[${time}] ${msg}`);
      },
      error: (msg: string, err?: any) => {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
        outputChannel.appendLine(
          `[${time}] ❌ ${msg} ${err ? err.message || JSON.stringify(err) : ""}`
        );
      },
      onActivity: () => {
        if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
        this.watchdogTimer = setTimeout(() => {
          this.log("💤 No activity for 30 minutes. Shutting down...");
          this.stop();
          if (this.onAutoStop) this.onAutoStop();
        }, this.WATCHDOG_TIMEOUT);
      },
      getConfig: (workspaceId: string, scope: "merged" | "global" | "workspace") => {
        return ConfigManager.getConfig(this.context, workspaceId, scope);
      },
      saveConfig: (
        workspaceId: string,
        scope: "global" | "workspace",
        updates: Partial<WebMCPConfig>
      ) => {
        return ConfigManager.saveConfig(this.context, workspaceId, scope, updates);
      },
      resetConfig: (workspaceId: string, scope: "global" | "workspace") => {
        return ConfigManager.resetConfig(this.context, workspaceId, scope);
      },
      getInternalTools: () => [RUN_IN_TERMINAL_TOOL],
      handleInternalToolCall: async (name: string, args: any) => {
        if (name === "run_in_terminal") {
          const { command, auto_focus = true } = args;
          const terminal = vscode.window.activeTerminal || vscode.window.createTerminal("WebMCP");
          terminal.sendText(command);
          if (auto_focus) terminal.show();
          return { content: [{ type: "text", text: `Command sent to terminal: ${command}` }] };
        }
        return undefined;
      },
    };
    super(hooks, "default");
  }
}
