import * as vscode from "vscode";

/**
 * Manages unique identifiers for VS Code workspaces.
 * This ID is used to isolate configurations and tool permissions in the browser extension.
 */
export class WorkspaceManager {
  private static readonly ID_KEY = "mcp.workspaceId";

  /**
   * Get or create a unique workspace ID.
   * For multi-root workspaces, we use the global ID if it exists,
   * but we generally target the workspace root.
   */
  static getWorkspaceId(context: vscode.ExtensionContext): string {
    let id = context.workspaceState.get<string>(this.ID_KEY);

    if (!id) {
      // Use built-in crypto for UUID generation
      id = (globalThis as any).crypto?.randomUUID() || Math.random().toString(36).substring(2, 12);
      context.workspaceState.update(this.ID_KEY, id);
    }

    return id as string;
  }

  /**
   * Get a display name for the workspace (for UI/Logs)
   */
  static getWorkspaceName(): string {
    return vscode.workspace.name || "Untitled Project";
  }
}
