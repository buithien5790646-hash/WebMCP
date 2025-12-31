import { useState, useEffect } from "react";
import {
  Trash2,
  Edit2,
  Plus,
  Globe,
  Terminal,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Loader2,
  Download,
  ShoppingBag,
  LayoutList,
  HardDrive,
  Github,
  Play,
  Clock,
  Database,
  Box,
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
import { cn } from "@/lib/utils";
import type { MCPService } from "@mcp-kit/core";

// Icon mapping for SDK string icons to Lucide components
const ICON_MAP: Record<string, any> = {
  HardDrive,
  Github,
  Globe,
  Play,
  Clock,
  Database,
  Box,
};

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

  // --- Marketplace State ---
  const [marketServices, setMarketServices] = useState<MCPService[]>([]);
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);
  const [installingItem, setInstallingItem] = useState<MCPService | null>(null);
  const [isPerformingInstall, setIsPerformingInstall] = useState(false);
  const [installForm, setInstallForm] = useState<{ env: Record<string, string>; args: string[] }>({
    env: {},
    args: [],
  });

  // Fetch market services when switching to market view
  useEffect(() => {
    if (view === "market") {
      fetchMarketServices();
    }
  }, [view]);

  const fetchMarketServices = async () => {
    setIsLoadingMarket(true);
    try {
      const result = await window.ipcRenderer.invoke("market:get-services");
      if (result.status === "success") {
        setMarketServices(result.services);
      } else {
        console.error("Failed to fetch market services:", result.message);
      }
    } catch (err) {
      console.error("IPC Error fetching market services:", err);
    } finally {
      setIsLoadingMarket(false);
    }
  };

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
    if (!newServer.name) {
      alert("Please provide a display name.");
      return;
    }
    if (newServer.type === "stdio" && !newServer.command) {
      alert("Please provide a command for stdio server.");
      return;
    }
    if ((newServer.type === "sse" || newServer.type === "http") && !newServer.url) {
      alert("Please provide a URL for remote server.");
      return;
    }

    const isEdit = !!newServer.id;
    const id = newServer.id || `server-${Date.now()}`;
    
    // If it's a new server or name changed, ensure uniqueness
    let finalName = newServer.name || "Untitled Server";
    if (!isEdit || (servers[id] && servers[id].name !== newServer.name)) {
      finalName = generateUniqueName(finalName);
    }

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

  const handleEdit = (server: ServerDefinition) => {
    setNewServer(server);
    setArgsStr(server.args?.join(" ") || "");
    setIsAdding(true);
    // Scroll to top or form
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const initiateInstall = (item: MCPService) => {
    // Reset form
    setInstallForm({ env: {}, args: new Array(item.variables?.args?.length || 0).fill("") });
    setInstallingItem(item);
  };

  const confirmInstall = async () => {
    if (!installingItem) return;

    // Validation
    if (installingItem.variables?.env) {
      for (const v of installingItem.variables.env) {
        if (v.required && !installForm.env[v.key]) {
          alert(`Please provide the required environment variable: ${v.label}`);
          return;
        }
      }
    }
    if (installingItem.variables?.args) {
      for (let i = 0; i < installingItem.variables.args.length; i++) {
        const v = installingItem.variables.args[i];
        if (v.required && !installForm.args[i]) {
          alert(`Please provide the required argument: ${v.label}`);
          return;
        }
      }
    }

    setIsPerformingInstall(true);
    try {
      // Use Market Kit to install the service
      const result = await window.ipcRenderer.invoke("market:install", installingItem);

      if (result.status === "success") {
        const id = `server-${Date.now()}`;
        const finalName = generateUniqueName(installingItem.name);

        const serverToSave: ServerDefinition = {
          id,
          name: finalName,
          type: "stdio", // Market kit services are currently all stdio based (local exec)
          command: result.config.command,
          args: [...result.config.args, ...installForm.args],
          env: installForm.env,
        };

        await window.ipcRenderer.invoke("db:save-server", serverToSave);
        setInstallingItem(null);
        setView("installed");
        onReload();
      } else {
        throw new Error(result.message || "Failed to install service via Market Kit");
      }
    } catch (err: any) {
      alert(`Installation failed: ${err.message}`);
    } finally {
      setIsPerformingInstall(false);
    }
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Command</label>
                      <Input
                        placeholder="e.g. node, python, npx"
                        value={newServer.command || ""}
                        onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Arguments (Space separated)</label>
                      <Input
                        placeholder="e.g. -y @mcp/server-filesystem /path"
                        value={argsStr}
                        onChange={(e) => setArgsStr(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Remote URL</label>
                    <Input
                      placeholder="https://mcp-server.example.com/sse"
                      value={newServer.url || ""}
                      onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
                    />
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
                <Button onClick={handleManualSave}>
                  <Save className="mr-2 h-4 w-4" /> Save Server
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* List of Installed Servers */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(servers).map((s) => (
              <Card key={s.id} className="group hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {s.type === "stdio" ? (
                          <Terminal className="w-4 h-4 text-primary" />
                        ) : (
                          <Globe className="w-4 h-4 text-primary" />
                        )}
                        {s.name}
                      </CardTitle>
                      <CardDescription className="font-mono text-[10px] truncate max-w-[200px]">
                        ID: {s.id}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleEdit(s)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="text-xs space-y-2">
                    {s.type === "stdio" ? (
                      <div className="bg-muted p-2 rounded font-mono break-all max-h-24 overflow-y-auto text-[11px] leading-relaxed">
                        {s.command} {s.args?.join(" ")}
                      </div>
                    ) : (
                      <div className="bg-muted p-2 rounded font-mono break-all max-h-24 overflow-y-auto text-[11px] leading-relaxed">
                        {s.url}
                      </div>
                    )}

                    {testResults[s.id] && (
                      <div
                        className={cn(
                          "flex items-center gap-1.5 p-1.5 rounded border",
                          testResults[s.id].ok
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        )}
                      >
                        {testResults[s.id].ok ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5" />
                        )}
                        <span className="font-medium truncate">{testResults[s.id].msg}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleTest(s)}
                    disabled={testingId === s.id}
                  >
                    {testingId === s.id ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="mr-2 h-3.5 w-3.5" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ----------------- VIEW: MARKETPLACE ----------------- */}
      {view === "market" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoadingMarket && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Loading MCP Marketplace...</p>
            </div>
          )}

          {!isLoadingMarket && marketServices.map((item) => (
            <Card key={item.id} className="flex flex-col border-primary/10 hover:border-primary/30 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {(() => {
                      const IconComp = ICON_MAP[item.icon || ""] || Box;
                      return <IconComp className="w-6 h-6" />;
                    })()}
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <CardDescription className="text-xs">by {item.author || "Unknown"}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {item.description}
                </p>
                <div className="mt-4 flex gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {item.type}
                  </Badge>
                  {item.metadata.version && (
                    <Badge variant="secondary" className="text-[10px]">
                      v{item.metadata.version}
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => initiateInstall(item)}
                >
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
            <CardFooter className="flex justify-between gap-3 bg-muted/20">
              <Button variant="outline" onClick={() => setInstallingItem(null)} disabled={isPerformingInstall}>
                Cancel
              </Button>
              <Button onClick={confirmInstall} disabled={isPerformingInstall}>
                {isPerformingInstall ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Confirm Installation
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
