import { useState, useEffect } from 'react'
import { LayoutDashboard, Library as LibraryIcon, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import Library from './Library'
import Dashboard from './Dashboard'
import SettingsView from './SettingsView'
import { Button } from '@/components/ui/button'
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
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({});
  const [config, setConfig] = useState<any>({ browser: 'default', aiSites: [] });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'library' | 'settings'>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Effects
  useEffect(() => {
    loadData();
    const cleanup = window.ipcRenderer.on('profile-status', (_e: any, data: any) => {
      setStatuses(prev => ({
        ...prev,
        [data.profileId]: { ...prev[data.profileId], status: data.status, port: data.port }
      }));
    });

    // Auto-collapse sidebar on small screens
    const handleResize = () => {
        if (window.innerWidth < 1024) {
            setIsSidebarCollapsed(true);
        } else {
            setIsSidebarCollapsed(false);
        }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    return () => {
        cleanup && cleanup();
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    // Store cleanup functions
    const removers: Function[] = [];

    Object.keys(profiles).forEach(id => {
      const removeListener = window.ipcRenderer.on(`log:${id}`, (_e: any, msg: string) => {
        setLogs(prev => ({
          ...prev,
          [id]: [...(prev[id] || []).slice(-99), msg]
        }));
      });
      if (removeListener) removers.push(removeListener);
    });

    // Cleanup all listeners when profiles change or component unmounts
    return () => {
      removers.forEach(remove => remove());
    };
  }, [profiles]);

  const loadData = async () => {
    try {
        const data = await window.ipcRenderer.invoke('db:get-all');
        setProfiles(data.profiles || {});
        setServers(data.servers || {});
        
        const envs = await window.ipcRenderer.invoke('env:check');
        setEnvStatus(envs);
        
        const cfg = await window.ipcRenderer.invoke('config:get');
        setConfig(cfg);
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

  const handleOpenBridge = (url: string, port: number, token: string, workspaceId: string, browserMode: string = 'default') => {
     const bridgeUrl = `http://127.0.0.1:${port}/bridge?token=${token}&target=${encodeURIComponent(url)}&workspaceId=${workspaceId}`;
     window.ipcRenderer.invoke('open-url', bridgeUrl, browserMode);
  };

  const handleSaveConfig = async (newConfig: any) => {
      await window.ipcRenderer.invoke('config:save', newConfig);
      setConfig(newConfig);
  };

  const handleSaveProfile = async (profile: ServiceProfile) => {
     await window.ipcRenderer.invoke('db:save-profile', profile);
     loadData();
  };

  const handleDeleteProfile = async (id: string) => {
      if (confirm('Delete this profile?')) {
        await handleStop(id);
        await window.ipcRenderer.invoke('db:delete-profile', id);
        loadData();
      }
  }

  const handleClearLogs = (id: string) => {
    setLogs(prev => ({ ...prev, [id]: [] }));
  };

  // Render
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar */}
      <aside className={cn(
          "border-r bg-muted/40 flex flex-col transition-all duration-300 ease-in-out relative",
          isSidebarCollapsed ? "w-16" : "w-64"
      )}>
        <div className={cn("p-6 border-b flex items-center", isSidebarCollapsed ? "justify-center px-0" : "justify-between")}>
            {!isSidebarCollapsed && (
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 overflow-hidden whitespace-nowrap">
                    <span className="text-primary">🕸</span> WebMCP
                </h1>
            )}
            {isSidebarCollapsed && <span className="text-xl text-primary">🕸</span>}
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-x-hidden">
            <Button 
                variant={activeTab === 'dashboard' ? 'secondary' : 'ghost'} 
                className={cn("w-full justify-start", isSidebarCollapsed && "justify-center px-0")}
                onClick={() => setActiveTab('dashboard')}
                title={isSidebarCollapsed ? "Dashboard" : ""}
            >
                <LayoutDashboard className={cn("h-4 w-4", !isSidebarCollapsed && "mr-2")} /> 
                {!isSidebarCollapsed && <span>Dashboard</span>}
            </Button>
            <Button 
                variant={activeTab === 'library' ? 'secondary' : 'ghost'} 
                className={cn("w-full justify-start", isSidebarCollapsed && "justify-center px-0")}
                onClick={() => setActiveTab('library')}
                title={isSidebarCollapsed ? "Server Library" : ""}
            >
                <LibraryIcon className={cn("h-4 w-4", !isSidebarCollapsed && "mr-2")} /> 
                {!isSidebarCollapsed && <span>Server Library</span>}
            </Button>
            <Button 
                variant={activeTab === 'settings' ? 'secondary' : 'ghost'} 
                className={cn("w-full justify-start", isSidebarCollapsed && "justify-center px-0")}
                onClick={() => setActiveTab('settings')}
                title={isSidebarCollapsed ? "Settings" : ""}
            >
                <Settings className={cn("h-4 w-4", !isSidebarCollapsed && "mr-2")} /> 
                {!isSidebarCollapsed && <span>Settings</span>}
            </Button>
        </nav>

        {/* Collapse Toggle */}
        <div className="p-4 border-t flex justify-center">
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:bg-muted"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            >
                {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" /> }
            </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'dashboard' ? (
            <Dashboard 
              profiles={profiles}
              servers={servers}
              statuses={statuses}
              logs={logs}
              config={config}
              onStart={handleStart}
              onStop={handleStop}
              onDelete={handleDeleteProfile}
              onSaveProfile={handleSaveProfile}
              onOpenBridge={handleOpenBridge}
              onNavigateToSettings={() => setActiveTab('settings')}
              onSaveConfig={handleSaveConfig}
              onClearLogs={handleClearLogs}
            />
          ) : activeTab === 'library' ? (
            <Library servers={servers} envStatus={envStatus} onReload={loadData} />
          ) : (
            <SettingsView config={config} onSave={handleSaveConfig} />
          )}
        </div>
      </main>
    </div>
  );
}

