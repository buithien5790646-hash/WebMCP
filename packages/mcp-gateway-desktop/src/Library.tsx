import { useState } from "react";
import {
  Trash2,
  Plus,
  Globe,
  Terminal,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Loader2,
  AlertTriangle,
  Download,
  ShoppingBag,
  LayoutList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MARKETPLACE_ITEMS, MarketplaceItem } from "./data/marketplace";
import { cn } from "@/lib/utils";

interface ServerDefinition {
  id: string;
  name: string;
  type: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

interface Props {
  servers: Record<string, ServerDefinition>;
  envStatus: Record<string, boolean>;
  onReload: () => void;
}

export default function Library({ servers, envStatus, onReload }: Props) {
  const [view, setView] = useState<"installed" | "market">("installed");

  // --- Manual Add State ---
  const [isAdding, setIsAdding] = useState(false);
  const [newServer, setNewServer] = useState<Partial<ServerDefinition>>({
    type: "stdio",
    command: "",
    args: [],
  });
  const [argsStr, setArgsStr] = useState("");

  // --- Testing State ---
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  // --- Marketplace Install State ---
  const [installingItem, setInstallingItem] = useState<MarketplaceItem | null>(null);
  const [installForm, setInstallForm] = useState<{ env: Record<string, string>; args: string[] }>({
    env: {},
    args: [],
  });

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  const generateUniqueName = (baseName: string) => {
    let name = baseName;
    let count = 1;
    const existingNames = Object.values(servers).map((s) => s.name);
    while (existingNames.includes(name)) {
      name = `${baseName} (${count})`;
      count++;
    }
    return name;
  };

  // --------------------------------------------------------------------------
  // Handlers: Manual Operations
  // --------------------------------------------------------------------------

  const handleManualSave = async () => {
    const id = newServer.id || `server-${Date.now()}`;
    // Check duplicate name
    const finalName = generateUniqueName(newServer.name || "Untitled Server");

    const serverToSave = {
      ...newServer,
      id,
      name: finalName,
      args: argsStr.split(" ").filter((s) => s.trim().length > 0),
    };

    await window.ipcRenderer.invoke("db:save-server", serverToSave);
    setIsAdding(false);
    setNewServer({ type: "stdio", command: "", args: [] });
    setArgsStr("");
    onReload();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this server?")) {
      await window.ipcRenderer.invoke("db:delete-server", id);
      onReload();
    }
  };

  const handleTest = async (server: ServerDefinition) => {
    setTestingId(server.id);
    setTestResults((prev) => {
      const n = { ...prev };
      delete n[server.id];
      return n;
    });

    try {
      const res = await window.ipcRenderer.invoke("gateway:test", server);
      setTestResults((prev) => ({
        ...prev,
        [server.id]: { ok: res.status === "ok", msg: res.message },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [server.id]: { ok: false, msg: err.message },
      }));
    } finally {
      setTestingId(null);
    }
  };

  // --------------------------------------------------------------------------
  // Handlers: Marketplace Operations
  // --------------------------------------------------------------------------

  const initiateInstall = (item: MarketplaceItem) => {
    // Reset form
    setInstallForm({ env: {}, args: new Array(item.variables?.args?.length || 0).fill("") });
    setInstallingItem(item);
  };

  const confirmInstall = async () => {
    if (!installingItem) return;

    const id = `server-${Date.now()}`;
    const finalName = generateUniqueName(installingItem.name);

    // Merge base args with user provided args
    const baseArgs = installingItem.install.args || [];
    const userArgs = installForm.args;
    const finalArgs = [...baseArgs, ...userArgs];

    const serverToSave: ServerDefinition = {
      id,
      name: finalName,
      type: installingItem.install.type,
      command: installingItem.install.command,
      args: finalArgs,
      url: installingItem.install.url,
      env: installForm.env,
    };

    await window.ipcRenderer.invoke("db:save-server", serverToSave);
    setInstallingItem(null);
    setView("installed");
    onReload();
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Server Library</h2>
            <p className="text-muted-foreground">Manage reusable MCP server definitions.</p>
            {/* Environment Badges */}
            <div className="flex gap-2 mt-2">
              {Object.entries(envStatus).map(([tool, installed]) => (
                <Badge
                  key={tool}
                  variant={installed ? "secondary" : "outline"}
                  className={
                    installed
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "text-muted-foreground opacity-50"
                  }
                >
                  {installed ? (
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                  ) : (
                    <X className="w-3 h-3 mr-1" />
                  )}
                  {tool}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex bg-muted p-1 rounded-lg">
            <button
              onClick={() => setView("installed")}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                view === "installed"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="w-4 h-4" /> Installed
            </button>
            <button
              onClick={() => setView("market")}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                view === "market"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ShoppingBag className="w-4 h-4" /> Marketplace
            </button>
          </div>
        </div>
      </div>

      {/* ----------------- VIEW: INSTALLED ----------------- */}
      {view === "installed" && (
        <div className="space-y-4">
          {!isAdding && (
            <Button
              onClick={() => setIsAdding(true)}
              variant="outline"
              className="w-full border-dashed py-8"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Custom Server Manually
            </Button>
          )}

          {/* Manual Add Form */}
          {isAdding && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle>Add Custom Server</CardTitle>
                <CardDescription>Define a local command or remote SSE endpoint.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Display Name</label>
                    <Input
                      placeholder="e.g. My Python Script"
                      value={newServer.name || ""}
                      onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <select
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={newServer.type}
                      onChange={(e) => setNewServer({ ...newServer, type: e.target.value as any })}
                    >
                      <option value="stdio">STDIO (Local Command)</option>
                      <option value="sse">SSE (Remote URL)</option>
                      <option value="http">HTTP (Remote API)</option>
                    </select>
                  </div>
                </div>

                {newServer.type === "stdio" ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Command</label>
                      <Input
                        placeholder="e.g. npx, docker, python"
                        value={newServer.command || ""}
                        onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                      />
                      {newServer.command && envStatus && envStatus[newServer.command] === false && (
                        <p className="text-xs text-destructive flex items-center mt-1">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Command '{newServer.command}' not detected in system path.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Arguments</label>
                      <Input
                        placeholder="Space separated args"
                        value={argsStr}
                        onChange={(e) => setArgsStr(e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">URL</label>
                    <Input
                      placeholder="https://..."
                      value={newServer.url || ""}
                      onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
                    />
                  </div>
                )}
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Button variant="ghost" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
                <Button onClick={handleManualSave}>
                  <Save className="mr-2 h-4 w-4" /> Save Definition
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Installed List */}
          <div className="grid gap-3">
            {Object.values(servers).length === 0 && !isAdding && (
              <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                No servers installed. Check the Marketplace to get started!
              </div>
            )}

            {Object.values(servers).map((server) => (
              <Card
                key={server.id}
                className="flex items-center justify-between p-4 hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    {server.type === "stdio" ? (
                      <Terminal className="h-5 w-5" />
                    ) : (
                      <Globe className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{server.name}</span>
                      <Badge variant="outline" className="text-[10px] h-5">
                        {server.type.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 font-mono">
                      {server.type === "stdio"
                        ? `$ ${server.command} ${(server.args || []).join(" ")}`
                        : `🔗 ${server.url}`}
                      {testResults[server.id] && (
                        <div
                          className={`text-xs flex items-center mt-2 ${testResults[server.id].ok ? "text-emerald-600" : "text-destructive"}`}
                        >
                          {testResults[server.id].ok ? (
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 mr-1" />
                          )}
                          {testResults[server.id].msg}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleTest(server)}
                    disabled={testingId === server.id}
                    title="Test Connection"
                  >
                    {testingId === server.id ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <PlayCircle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(server.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ----------------- VIEW: MARKETPLACE ----------------- */}
      {view === "market" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MARKETPLACE_ITEMS.map((item) => (
            <Card key={item.id} className="flex flex-col h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <Badge variant="secondary">Official</Badge>
                </div>
                <CardTitle className="mt-4">{item.name}</CardTitle>
                <CardDescription className="line-clamp-2">{item.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded font-mono break-all">
                  $ {item.install.command} {(item.install.args || []).join(" ")} ...
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={() => initiateInstall(item)}>
                  <Download className="mr-2 h-4 w-4" /> Install
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* ----------------- INSTALL WIZARD (OVERLAY) ----------------- */}
      {installingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg shadow-xl animate-in fade-in zoom-in duration-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Configure {installingItem.name}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setInstallingItem(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Please provide the necessary configuration to run this server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
              {/* No Vars case */}
              {!installingItem.variables?.env && !installingItem.variables?.args && (
                <div className="text-sm text-muted-foreground">
                  This server requires no additional configuration. Click Install to proceed.
                </div>
              )}

              {/* Env Vars */}
              {installingItem.variables?.env?.map((v) => (
                <div key={v.key} className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    {v.label} {v.required && <span className="text-destructive">*</span>}
                  </label>
                  <Input
                    placeholder={v.placeholder}
                    value={installForm.env[v.key] || ""}
                    onChange={(e) =>
                      setInstallForm((prev) => ({
                        ...prev,
                        env: { ...prev.env, [v.key]: e.target.value },
                      }))
                    }
                  />
                  {v.description && (
                    <p className="text-xs text-muted-foreground">{v.description}</p>
                  )}
                </div>
              ))}

              {/* Args Vars */}
              {installingItem.variables?.args?.map((v, idx) => (
                <div key={idx} className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    {v.label} {v.required && <span className="text-destructive">*</span>}
                  </label>
                  <Input
                    placeholder={v.placeholder}
                    value={installForm.args[idx] || ""}
                    onChange={(e) => {
                      const newArgs = [...installForm.args];
                      newArgs[idx] = e.target.value;
                      setInstallForm((prev) => ({ ...prev, args: newArgs }));
                    }}
                  />
                  {v.description && (
                    <p className="text-xs text-muted-foreground">{v.description}</p>
                  )}
                </div>
              ))}
            </CardContent>
            <CardFooter className="justify-end gap-2 bg-muted/20">
              <Button variant="ghost" onClick={() => setInstallingItem(null)}>
                Cancel
              </Button>
              <Button onClick={confirmInstall}>Confirm & Install</Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
