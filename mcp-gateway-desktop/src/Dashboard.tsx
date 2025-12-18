import { useState, useEffect, useRef } from 'react';
import { Play, Square, Trash2, Plus, ExternalLink, Monitor, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
  type: 'stdio' | 'sse';
  command?: string;
  url?: string;
}

interface DashboardProps {
  profiles: Record<string, ServiceProfile>;
  servers: Record<string, ServerDefinition>;
  statuses: Record<string, { status: 'online' | 'offline', port?: number, token?: string }>;
  logs: Record<string, string[]>;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveProfile: (profile: ServiceProfile) => void;
  onOpenBridge: (url: string, port: number, token: string) => void;
}

export default function Dashboard({ profiles, servers, statuses, logs, onStart, onStop, onDelete, onSaveProfile, onOpenBridge }: DashboardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(Object.keys(profiles)[0] || null);
  
  // Launcher State
  const [targetSite, setTargetSite] = useState('https://chatgpt.com');

  // Auto-select first profile if none selected
  useEffect(() => {
    if (!selectedId && Object.keys(profiles).length > 0) {
        setSelectedId(Object.keys(profiles)[0]);
    }
  }, [profiles]);

  const activeProfile = selectedId ? profiles[selectedId] : null;
  const activeStatus = selectedId ? statuses[selectedId] : null;
  const isOnline = activeStatus?.status === 'online';
  const activeLogs = selectedId ? (logs[selectedId] || []) : [];

  // --- Handlers ---
  const handleCreate = () => {
      const id = `profile-${Date.now()}`;
      const newProfile: ServiceProfile = {
          id,
          name: 'New Instance',
          port: 34567 + Object.keys(profiles).length,
          serverIds: []
      };
      onSaveProfile(newProfile);
      setSelectedId(id);
  };

  const handleToggleServer = (serverId: string) => {
      if (!activeProfile || isOnline) return;
      const current = activeProfile.serverIds || [];
      const next = current.includes(serverId)
        ? current.filter(id => id !== serverId)
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
      if (!activeStatus?.port || !activeStatus?.token) return;
      onOpenBridge(targetSite, activeStatus.port, activeStatus.token);
  };

  // --- Render ---
  return (
    <div className="flex h-full border rounded-lg overflow-hidden bg-background shadow-sm ring-1 ring-border">
      
      {/* LEFT SIDEBAR: Profile List */}
      <div className="w-64 bg-muted/20 border-r flex flex-col">
        <div className="p-3 border-b bg-muted/40">
             <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Instances</h3>
             <Button size="sm" className="w-full justify-start" variant="outline" onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" /> New Instance
             </Button>
        </div>
        <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
                {Object.values(profiles).map(profile => {
                    const status = statuses[profile.id]?.status || 'offline';
                    return (
                        <div 
                            key={profile.id}
                            onClick={() => setSelectedId(profile.id)}
                            className={cn(
                                "flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors text-sm",
                                selectedId === profile.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"
                            )}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className={cn("w-2 h-2 rounded-full shrink-0", status === 'online' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-zinc-300 dark:bg-zinc-700")} />
                                <span className="truncate">{profile.name}</span>
                            </div>
                            {selectedId === profile.id && (
                                <Trash2 
                                    className="w-4 h-4 text-muted-foreground/50 hover:text-destructive shrink-0"
                                    onClick={(e) => { e.stopPropagation(); onDelete(profile.id); }}
                                />
                            )}
                        </div>
                    )
                })}
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
                                onChange={e => handleRename(e.target.value)}
                                disabled={isOnline}
                            />
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Monitor className="w-3 h-3" /> 
                                    Port: 
                                    <input 
                                        className="bg-transparent w-12 border-b border-dotted focus:outline-none focus:border-primary text-foreground"
                                        value={activeProfile.port}
                                        onChange={e => handlePortChange(e.target.value)}
                                        disabled={isOnline}
                                    />
                                </span>
                                {isOnline && <span className="text-emerald-500 flex items-center gap-1">● Running on port {activeStatus?.port}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {!isOnline ? (
                            <Button onClick={() => onStart(activeProfile.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]">
                                <Play className="w-4 h-4 mr-2 fill-current" /> Start Gateway
                            </Button>
                        ) : (
                            <Button onClick={() => onStop(activeProfile.id)} variant="destructive" className="min-w-[120px]">
                                <Square className="w-4 h-4 mr-2 fill-current" /> Stop
                            </Button>
                        )}
                    </div>
                </div>

                {/* Body Tabs */}
                <Tabs defaultValue="logs" className="flex-1 flex flex-col min-h-0">
                    <div className="px-6 border-b bg-muted/5">
                        <TabsList className="h-10 bg-transparent">
                            <TabsTrigger value="services" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4">Configure Services</TabsTrigger>
                            <TabsTrigger value="logs" className="data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4">Live Logs</TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Tab: Services */}
                    <TabsContent value="services" className="flex-1 p-6 overflow-y-auto space-y-6">
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
                                    {Object.values(servers).map(srv => (
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
                                            <div className={cn(
                                                "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                                activeProfile.serverIds.includes(srv.id) ? "bg-primary border-primary" : "bg-background"
                                            )}>
                                                {activeProfile.serverIds.includes(srv.id) && <div className="w-2 h-2 bg-white rounded-sm" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{srv.name}</div>
                                                <div className="text-xs text-muted-foreground truncate font-mono">{srv.type === 'stdio' ? srv.command : srv.url}</div>
                                            </div>
                                            <Badge variant="outline" className="text-[10px]">{srv.type.toUpperCase()}</Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Tab: Logs */}
                    <TabsContent value="logs" className="flex-1 flex flex-col min-h-0 bg-zinc-950">
                        <LogViewer logs={activeLogs} isRunning={isOnline} />
                    </TabsContent>
                </Tabs>

                {/* Footer: Launcher */}
                <div className="h-16 border-t bg-muted/10 flex items-center px-6 gap-4">
                    <div className="flex-1 flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Launch AI Client:</span>
                        <Select value={targetSite} onValueChange={setTargetSite}>
                            <SelectTrigger className="w-[200px] bg-background">
                                <SelectValue placeholder="Select AI Site" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="https://chatgpt.com">ChatGPT</SelectItem>
                                <SelectItem value="https://claude.ai">Claude</SelectItem>
                                <SelectItem value="http://localhost:3000">Localhost (Test)</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button 
                            disabled={!isOnline} 
                            onClick={handleLaunch}
                            className="gap-2"
                            variant="secondary"
                        >
                            <ExternalLink className="w-4 h-4" /> 
                            {isOnline ? 'Open Bridge' : 'Start Gateway First'}
                        </Button>
                    </div>
                    {isOnline && activeStatus?.token && (
                         <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded select-all">
                            Token: {activeStatus.token.slice(0, 8)}...
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

function LogViewer({ logs, isRunning }: { logs: string[], isRunning: boolean }) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1 text-zinc-300">
            {logs.length === 0 && (
                <div className="opacity-30 italic p-4 text-center">
                    {isRunning ? "Waiting for server logs..." : "Server is offline."}
                </div>
            )}
            {logs.map((line, i) => (
                <div key={i} className="break-all whitespace-pre-wrap border-l-2 border-transparent hover:border-zinc-700 pl-2 hover:bg-zinc-900/50">
                    {line}
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    );
}