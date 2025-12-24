import { useState, useEffect, useRef } from "react";
import {
  Play,
  Square,
  Trash2,
  Plus,
  ExternalLink,
  Monitor,
  Command,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// --- Types ---
interface ServiceProfile {
  id: string;
  name: string;
  port: number;
  serverIds: string[];
  color?: string;
}

interface ServerDefinition {
  id: string;
  name: string;
  type: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

interface DashboardProps {
  profiles: Record<string, ServiceProfile>;
  servers: Record<string, ServerDefinition>;
  statuses: Record<
    string,
    { status: "online" | "offline" | "starting"; port?: number; token?: string }
  >;
  logs: Record<string, string[]>;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveProfile: (profile: ServiceProfile) => void;
  onOpenBridge: (
    url: string,
    port: number,
    token: string,
    workspaceId: string,
    browser?: string
  ) => void;
  config: any;
  onNavigateToSettings: () => void;
  onSaveConfig: (config: any) => void;
  onClearLogs: (id: string) => void;
}

export default function Dashboard({
  profiles,
  servers,
  statuses,
  logs,
  config,
  onStart,
  onStop,
  onDelete,
  onSaveProfile,
  onOpenBridge,
  onNavigateToSettings,
  onSaveConfig,
  onClearLogs,
}: DashboardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(Object.keys(profiles)[0] || null);
  const [isListCollapsed, setIsListCollapsed] = useState(false);

  // Launcher State
  const [targetSite, setTargetSite] = useState(
    config.lastSelectedSite || config.aiSites?.[0]?.address || "https://chatgpt.com"
  );

  useEffect(() => {
    if (
      config.aiSites &&
      config.aiSites.length > 0 &&
      !config.aiSites.find((s: any) => s.address === targetSite)
    ) {
      setTargetSite(config.lastSelectedSite || config.aiSites[0].address);
    }
  }, [config]);

  // Auto-collapse list on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1200) {
        setIsListCollapsed(true);
      } else {
        setIsListCollapsed(false);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleTargetSiteChange = (val: string) => {
    setTargetSite(val);
    onSaveConfig({ ...config, lastSelectedSite: val });
  };

  // Auto-select first profile if none selected
  useEffect(() => {
    if (!selectedId && Object.keys(profiles).length > 0) {
      setSelectedId(Object.keys(profiles)[0]);
    }
  }, [profiles]);

  const activeProfile = selectedId ? profiles[selectedId] : null;
  const activeStatus = selectedId ? statuses[selectedId] : null;
  const isOnline = activeStatus?.status === "online";
  const isStarting = activeStatus?.status === "starting";
  const activeLogs = selectedId ? logs[selectedId] || [] : [];

  // --- Handlers ---
  const handleCreate = () => {
    const id = `profile-${Date.now()}`;
    const newProfile: ServiceProfile = {
      id,
      name: "New Instance",
      port: 34567 + Object.keys(profiles).length,
      serverIds: [],
    };
    onSaveProfile(newProfile);
    setSelectedId(id);
  };

  const handleToggleServer = (serverId: string) => {
    if (!activeProfile || isOnline) return;
    const current = activeProfile.serverIds || [];
    const next = current.includes(serverId)
      ? current.filter((id) => id !== serverId)
      : [...current, serverId];
    onSaveProfile({ ...activeProfile, serverIds: next });
  };

  const handlePortChange = (val: string) => {
    if (!activeProfile || isOnline) return;
    const port = parseInt(val) || 0;
    onSaveProfile({ ...activeProfile, port });
  };

  const handleRename = (val: string) => {
    if (!activeProfile) return;
    onSaveProfile({ ...activeProfile, name: val });
  };

  const handleLaunch = () => {
    if (!activeProfile || !activeStatus?.port || !activeStatus?.token) return;

    // Determine Browser
    const siteConfig = config.aiSites.find((s: any) => s.address === targetSite);
    let browser = config.browser || "default";
    if (siteConfig && siteConfig.browser && siteConfig.browser !== "default") {
      browser = siteConfig.browser;
    }

    onOpenBridge(targetSite, activeStatus.port, activeStatus.token, activeProfile.id, browser);
  };

  // --- Render ---
  return (
    <div className="flex h-full border rounded-lg overflow-hidden bg-background shadow-sm ring-1 ring-border">
      {/* LEFT SIDEBAR: Profile List */}
      <div
        className={cn(
          "bg-muted/20 border-r flex flex-col transition-all duration-300",
          isListCollapsed ? "w-12" : "w-64"
        )}
      >
        <div
          className={cn(
            "p-3 border-b bg-muted/40 flex items-center",
            isListCollapsed ? "justify-center px-0" : "justify-between"
          )}
        >
          {!isListCollapsed && (
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Instances
            </h3>
          )}
          <Button
            size="sm"
            variant="ghost"
            className={cn("h-8 w-8 p-0 rounded-full", !isListCollapsed && "ml-auto")}
            onClick={() => setIsListCollapsed(!isListCollapsed)}
          >
            {isListCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        </div>
        {!isListCollapsed && (
          <div className="p-3 border-b bg-muted/20">
            <Button
              size="sm"
              className="w-full justify-start"
              variant="outline"
              onClick={handleCreate}
            >
              <Plus className="w-4 h-4 mr-2" /> New Instance
            </Button>
          </div>
        )}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {Object.values(profiles).map((profile) => {
              const status = statuses[profile.id]?.status || "offline";
              return (
                <div
                  key={profile.id}
                  onClick={() => setSelectedId(profile.id)}
                  className={cn(
                    "flex items-center rounded-md cursor-pointer transition-colors text-sm relative",
                    isListCollapsed
                      ? "justify-center h-10 w-8 mx-auto"
                      : "px-3 py-2 justify-between",
                    selectedId === profile.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                  title={isListCollapsed ? profile.name : ""}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        status === "online"
                          ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                          : status === "starting"
                            ? "bg-amber-500 animate-pulse"
                            : "bg-zinc-300 dark:bg-zinc-700",
                        isListCollapsed && "w-3 h-3"
                      )}
                    />
                    {!isListCollapsed && <span className="truncate">{profile.name}</span>}
                  </div>
                  {!isListCollapsed && selectedId === profile.id && (
                    <Trash2
                      className="w-4 h-4 text-muted-foreground/50 hover:text-destructive shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(profile.id);
                      }}
                    />
                  )}
                  {isListCollapsed && selectedId === profile.id && (
                    <div className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
                  )}
                </div>
              );
            })}
            {isListCollapsed && (
              <div className="pt-2 flex justify-center">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  onClick={handleCreate}
                  title="New Instance"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT MAIN: Detail View */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {activeProfile ? (
          <>
            {/* Header */}
            <div className="h-16 border-b flex items-center justify-between px-6 bg-card">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <Input
                    className="h-7 text-lg font-semibold border-transparent hover:border-input focus:border-input px-0 w-48"
                    value={activeProfile.name}
                    onChange={(e) => handleRename(e.target.value)}
                    disabled={isOnline}
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Monitor className="w-3 h-3" />
                      Port:
                      <input
                        className={cn(
                          "bg-transparent w-12 border-b border-dotted focus:outline-none focus:border-primary text-foreground",
                          isOnline &&
                            activeStatus?.port !== activeProfile.port &&
                            "text-amber-500 font-bold"
                        )}
                        value={isOnline ? activeStatus?.port : activeProfile.port}
                        onChange={(e) => handlePortChange(e.target.value)}
                        disabled={isOnline}
                      />
                    </span>
                    {isOnline && (
                      <span className="text-emerald-500 flex items-center gap-1">
                        ● Running on port {activeStatus?.port}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isStarting ? (
                  <Button disabled className="bg-amber-600 text-white min-w-[120px]">
                    <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Starting...
                  </Button>
                ) : !isOnline ? (
                  <Button
                    onClick={() => onStart(activeProfile.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
                  >
                    <Play className="w-4 h-4 mr-2 fill-current" /> Start Gateway
                  </Button>
                ) : (
                  <Button
                    onClick={() => onStop(activeProfile.id)}
                    variant="destructive"
                    className="min-w-[120px]"
                  >
                    <Square className="w-4 h-4 mr-2 fill-current" /> Stop
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onNavigateToSettings}
                  title="Configure Launch Settings"
                >
                  <SettingsIcon className="w-5 h-5 text-muted-foreground" />
                </Button>
              </div>
            </div>

            {/* Body Tabs */}
            <Tabs defaultValue="logs" className="flex-1 flex flex-col min-h-0 bg-background">
              <div className="px-6 border-b bg-muted/5">
                <TabsList className="h-10 bg-transparent">
                  <TabsTrigger
                    value="services"
                    className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
                  >
                    Configure Services
                  </TabsTrigger>
                  <TabsTrigger
                    value="logs"
                    className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
                  >
                    Live Logs
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab: Services */}
              <TabsContent
                value="services"
                className="flex-1 p-6 overflow-y-auto space-y-6 m-0 border-0"
              >
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Command className="w-4 h-4" /> Enabled MCP Servers
                  </h3>
                  {Object.keys(servers).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                      No servers installed. Go to Library to add some.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.values(servers).map((srv) => (
                        <div
                          key={srv.id}
                          onClick={() => handleToggleServer(srv.id)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                            activeProfile.serverIds.includes(srv.id)
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "hover:border-primary/50 opacity-70"
                          )}
                        >
                          <div
                            className={cn(
                              "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                              activeProfile.serverIds.includes(srv.id)
                                ? "bg-primary border-primary"
                                : "bg-background"
                            )}
                          >
                            {activeProfile.serverIds.includes(srv.id) && (
                              <div className="w-2 h-2 bg-white rounded-sm" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{srv.name}</div>
                            <div className="text-xs text-muted-foreground truncate font-mono">
                              {srv.type === "stdio" ? srv.command : srv.url}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {srv.type.toUpperCase()}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Tab: Logs */}
              <TabsContent value="logs" className="flex-1 flex flex-col min-h-0 m-0 border-0">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                  <span className="text-xs font-medium text-muted-foreground">Runtime Output</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => selectedId && onClearLogs(selectedId)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Clear Logs
                  </Button>
                </div>
                <div className="flex-1 bg-zinc-950 overflow-hidden flex flex-col">
                  <LogViewer logs={activeLogs} isRunning={isOnline} />
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer: Launcher */}
            <div className="min-h-16 border-t bg-muted/10 flex flex-wrap items-center px-6 py-3 gap-4">
              <div className="flex-1 flex flex-wrap items-center gap-3 min-w-[300px]">
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  Launch AI Client:
                </span>
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Select value={targetSite} onValueChange={handleTargetSiteChange}>
                    <SelectTrigger className="w-full max-w-[220px] bg-background">
                      <SelectValue placeholder="Select AI Site" />
                    </SelectTrigger>
                    <SelectContent>
                      {config.aiSites.map((site: any) => (
                        <SelectItem key={site.address} value={site.address}>
                          <div className="flex items-center gap-2">
                            <span>{site.name}</span>
                            {site.browser && site.browser !== "default" && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded uppercase">
                                {site.browser}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    disabled={!isOnline}
                    onClick={handleLaunch}
                    className="gap-2 shrink-0"
                    variant="secondary"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {isStarting ? "Starting..." : isOnline ? "Open Bridge" : "Start Gateway First"}
                  </Button>
                </div>
              </div>
              {isOnline && activeStatus?.token && (
                <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded select-all shrink-0 ml-auto">
                  <span className="opacity-50 mr-1">Token:</span>
                  {activeStatus.token.slice(0, 8)}...
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select or create an instance to get started.
          </div>
        )}
      </div>
    </div>
  );
}

function LogViewer({ logs, isRunning }: { logs: string[]; isRunning: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1 text-zinc-300">
      {logs.length === 0 && (
        <div className="opacity-30 italic p-4 text-center">
          {isRunning ? "Waiting for server logs..." : "Server is offline."}
        </div>
      )}
      {logs.map((line, i) => (
        <div
          key={i}
          className="break-all whitespace-pre-wrap border-l-2 border-transparent hover:border-zinc-700 pl-2 hover:bg-zinc-900/50"
        >
          {line}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
