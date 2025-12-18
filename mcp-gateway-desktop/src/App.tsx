import { useState, useEffect, useRef } from 'react'
import { LayoutDashboard, Library as LibraryIcon, Plus, Play, Square, ExternalLink, Trash2, Server } from 'lucide-react'
import Library from './Library'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Types
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
}

interface ProfileStatus {
  status: 'online' | 'offline';
  port?: number;
  token?: string;
}

export default function App() {
  // Safety Check
  if (!window.ipcRenderer) {
    return (
      <div className="flex h-screen items-center justify-center bg-destructive/10">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">❌ Fatal Error</h1>
          <p className="text-muted-foreground">Could not connect to Main Process.</p>
        </div>
      </div>
    );
  }

  // State
  const [profiles, setProfiles] = useState<Record<string, ServiceProfile>>({});
  const [servers, setServers] = useState<Record<string, ServerDefinition>>({});
  const [statuses, setStatuses] = useState<Record<string, ProfileStatus>>({});
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [activeTab, setActiveTab] = useState<'dashboard' | 'library'>('dashboard');
  
  const [isCreating, setIsCreating] = useState(false);
  const [newProfile, setNewProfile] = useState<Partial<ServiceProfile>>({ name: '', port: 3000, serverIds: [] });

  // Effects
  useEffect(() => {
    loadData();
    const cleanup = window.ipcRenderer.on('profile-status', (_e: any, data: any) => {
      setStatuses(prev => ({
        ...prev,
        [data.profileId]: { ...prev[data.profileId], status: data.status, port: data.port }
      }));
    });
    return () => cleanup && cleanup();
  }, []);

  useEffect(() => {
    Object.keys(profiles).forEach(id => {
      window.ipcRenderer.on(`log:${id}`, (_e: any, msg: string) => {
        setLogs(prev => ({
          ...prev,
          [id]: [...(prev[id] || []).slice(-99), msg]
        }));
      });
    });
  }, [profiles]);

  const loadData = async () => {
    try {
        const data = await window.ipcRenderer.invoke('db:get-all');
        setProfiles(data.profiles || {});
        setServers(data.servers || {});
    } catch (err) {
        console.error("Failed to load data:", err);
    }
  };

  // Handlers
  const handleStart = async (id: string) => {
    setStatuses(prev => ({ ...prev, [id]: { ...prev[id], status: 'online' } })); 
    const res = await window.ipcRenderer.invoke('gateway:start', id);
    if (res.status === 'success') {
      setStatuses(prev => ({
        ...prev,
        [id]: { status: 'online', port: res.port, token: res.token }
      }));
    } else {
      setStatuses(prev => ({ ...prev, [id]: { ...prev[id], status: 'offline' } }));
    }
  };

  const handleStop = async (id: string) => {
    await window.ipcRenderer.invoke('gateway:stop', id);
    setStatuses(prev => ({ ...prev, [id]: { ...prev[id], status: 'offline' } }));
  };

  const handleOpenBridge = (port: number, token?: string) => {
     if (!token) return;
     window.ipcRenderer.invoke('open-url', `http://127.0.0.1:${port}/bridge?token=${token}`);
  };

  const handleCreateProfile = async () => {
      const id = `profile-${Date.now()}`;
      const profile = { ...newProfile, id, color: 'blue' } as ServiceProfile;
      await window.ipcRenderer.invoke('db:save-profile', profile);
      setIsCreating(false);
      setNewProfile({ name: '', port: 3000 + Object.keys(profiles).length + 1, serverIds: [] });
      loadData();
  };

  const handleDeleteProfile = async (id: string) => {
      if (confirm('Delete this profile?')) {
        await handleStop(id);
        await window.ipcRenderer.invoke('db:delete-profile', id);
        loadData();
      }
  }

  // Render
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/40 flex flex-col">
        <div className="p-6 border-b">
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <span className="text-primary">🕸</span> WebMCP
            </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
            <Button 
                variant={activeTab === 'dashboard' ? 'secondary' : 'ghost'} 
                className="w-full justify-start"
                onClick={() => setActiveTab('dashboard')}
            >
                <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
            </Button>
            <Button 
                variant={activeTab === 'library' ? 'secondary' : 'ghost'} 
                className="w-full justify-start"
                onClick={() => setActiveTab('library')}
            >
                <LibraryIcon className="mr-2 h-4 w-4" /> Server Library
            </Button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {activeTab === 'dashboard' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <p className="text-muted-foreground">Manage your active MCP gateway instances.</p>
                </div>
                <Button onClick={() => setIsCreating(true)}><Plus className="mr-2 h-4 w-4"/> New Instance</Button>
            </div>

            {isCreating && (
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle>Create New Instance</CardTitle>
                        <CardDescription>Configure a new gateway instance to host your tools.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-3 space-y-2">
                                <label className="text-sm font-medium">Instance Name</label>
                                <Input 
                                    value={newProfile.name} 
                                    onChange={e => setNewProfile({...newProfile, name: e.target.value})} 
                                    placeholder="e.g. Python Workspace"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Port</label>
                                <Input 
                                    type="number" 
                                    value={newProfile.port} 
                                    onChange={e => setNewProfile({...newProfile, port: parseInt(e.target.value)})}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Select Tools</label>
                            <div className="flex flex-wrap gap-2">
                                {Object.values(servers).map(srv => (
                                    <div 
                                        key={srv.id} 
                                        onClick={() => {
                                            const current = newProfile.serverIds || [];
                                            const next = current.includes(srv.id) 
                                                ? current.filter(id => id !== srv.id)
                                                : [...current, srv.id];
                                            setNewProfile({...newProfile, serverIds: next});
                                        }}
                                        className={cn(
                                            "px-3 py-1 rounded-full text-xs cursor-pointer border transition-colors",
                                            newProfile.serverIds?.includes(srv.id) 
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-background hover:bg-muted"
                                        )}
                                    >
                                        {srv.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                        <Button onClick={handleCreateProfile}>Create Instance</Button>
                    </CardFooter>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.values(profiles).map(profile => (
                <ProfileCard 
                  key={profile.id} 
                  profile={profile} 
                  status={statuses[profile.id]?.status || 'offline'} 
                  actualPort={statuses[profile.id]?.port}
                  token={statuses[profile.id]?.token}
                  logs={logs[profile.id] || []}
                  onStart={() => handleStart(profile.id)}
                  onStop={() => handleStop(profile.id)}
                  onDelete={() => handleDeleteProfile(profile.id)}
                  onOpenBridge={(port: number, token: string) => handleOpenBridge(port, token)}
                />
              ))}
            </div>
          </div>
        ) : (
          <Library servers={servers} onReload={loadData} />
        )}
      </main>
    </div>
  );
}

function ProfileCard({ profile, status, actualPort, token, logs, onStart, onStop, onDelete, onOpenBridge }: any) {
  const isOnline = status === 'online';
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card className="flex flex-col overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
        <div>
            <CardTitle className="text-lg">{profile.name}</CardTitle>
            <CardDescription>Port: {profile.port}</CardDescription>
        </div>
        <div className="flex gap-2">
            <Badge variant={isOnline ? "success" : "secondary"}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Badge>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
      </CardHeader>
      
      <div className="flex-1 bg-zinc-950 p-4 mx-6 rounded-md overflow-hidden min-h-[160px] relative group">
        <div 
            ref={scrollRef}
            className="h-full overflow-y-auto font-mono text-xs text-zinc-400 space-y-1 scrollbar-hide"
            style={{ maxHeight: 160 }}
        >
            {logs.length === 0 && <span className="opacity-50 italic">Waiting for logs...</span>}
            {logs.map((line: string, i: number) => (
                <div key={i} className="break-all whitespace-pre-wrap">{line}</div>
            ))}
        </div>
      </div>

      <CardFooter className="pt-4 gap-2">
        {!isOnline ? (
            <Button className="w-full" onClick={onStart}>
                <Play className="mr-2 h-4 w-4" /> Start Gateway
            </Button>
        ) : (
            <>
                <Button className="flex-1" variant="default" onClick={() => onOpenBridge(actualPort || profile.port, token)}>
                   <ExternalLink className="mr-2 h-4 w-4" /> Open Bridge
                </Button>
                <Button variant="destructive" size="icon" onClick={onStop}>
                    <Square className="h-4 w-4 fill-current" />
                </Button>
            </>
        )}
      </CardFooter>
    </Card>
  );
}