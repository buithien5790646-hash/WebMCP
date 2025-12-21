import * as vscode from "vscode";

export class MCPServiceProvider implements vscode.TreeDataProvider<MCPServiceItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<MCPServiceItem | undefined | void> =
    new vscode.EventEmitter<MCPServiceItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<MCPServiceItem | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MCPServiceItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MCPServiceItem): Thenable<MCPServiceItem[]> {
    if (element) {
      return Promise.resolve([]);
    } else {
      const config = vscode.workspace.getConfiguration("mcpGateway");
      const servers = config.get<Record<string, any>>("servers") || {};

      const enabledServices = this.context.workspaceState.get<string[]>("mcp.enabledServices");

      const items = Object.entries(servers).map(([id, info]) => {
        // If enabledServices is undefined, default to true for all
        const isEnabled = enabledServices === undefined ? true : enabledServices.includes(id);
        return new MCPServiceItem(
          id,
          info.name || id,
          isEnabled,
          vscode.TreeItemCollapsibleState.None
        );
      });

      return Promise.resolve(items);
    }
  }

  toggleService(id: string): void {
    const config = vscode.workspace.getConfiguration("mcpGateway");
    const servers = config.get<Record<string, any>>("servers") || {};

    let enabledServices = this.context.workspaceState.get<string[]>("mcp.enabledServices");

    // If it's the first time toggling, initialize with all servers except the one being toggled off,
    // OR if it was already initialized, just update the list.
    if (enabledServices === undefined) {
      enabledServices = Object.keys(servers);
    }

    const index = enabledServices.indexOf(id);
    if (index > -1) {
      enabledServices.splice(index, 1);
    } else {
      enabledServices.push(id);
    }

    this.context.workspaceState.update("mcp.enabledServices", enabledServices);
    this.refresh();

    // Trigger gateway restart if it's running
    vscode.commands.executeCommand("mcp-gateway-vscode.restart");
  }
}

export class MCPServiceItem extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly isEnabled: boolean,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);

    this.contextValue = "mcpService";
    this.iconPath = new vscode.ThemeIcon(isEnabled ? "check" : "circle-outline");
    this.description = isEnabled ? "Enabled" : "Disabled";
    this.tooltip = `${label} (${id})`;

    this.command = {
      command: "mcp-gateway.toggleService",
      title: "Toggle Service",
      arguments: [this.id],
    };
  }
}
