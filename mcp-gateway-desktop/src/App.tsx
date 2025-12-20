import { useState, useEffect } from 'react'
import { LayoutDashboard, Library as LibraryIcon, Settings } from 'lucide-react'
import Library from './Library'
import Dashboard from './Dashboard'
import SettingsView from './SettingsView'
import { Button } from '@/components/ui/button'

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

  const handleOpenBridge = (url: string, port: number, token?: string, browserMode: string = 'default') => {
     if (!token) return;
     const bridgeUrl = `http://127.0.0.1:${port}/bridge?token=${token}&target=${encodeURIComponent(url)}`;
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
            <Button 
                variant={activeTab === 'settings' ? 'secondary' : 'ghost'} 
                className="w-full justify-start"
                onClick={() => setActiveTab('settings')}
            >
                <Settings className="mr-2 h-4 w-4" /> Settings
            </Button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
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
          />
        ) : activeTab === 'library' ? (
          <Library servers={servers} envStatus={envStatus} onReload={loadData} />
        ) : (
          <SettingsView config={config} onSave={handleSaveConfig} />
        )}
      </main>
    </div>
  );
}

