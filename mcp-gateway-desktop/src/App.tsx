import { useState, useEffect, useRef } from 'react'
import Library from './Library';

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
  // 1. 安全检查：确保 IPC 可用
  if (!window.ipcRenderer) {
    return (
      <div style={{ padding: 40, color: 'red', fontFamily: 'sans-serif' }}>
        <h1>❌ Fatal Error</h1>
        <p>Could not connect to the Main Process.</p>
        <p><code>window.ipcRenderer</code> is undefined.</p>
        <p>Try restarting the terminal (Ctrl+C and pnpm run dev).</p>
      </div>
    );
  }

  const [profiles, setProfiles] = useState<Record<string, ServiceProfile>>({});
  const [servers, setServers] = useState<Record<string, ServerDefinition>>({});
  const [statuses, setStatuses] = useState<Record<string, ProfileStatus>>({});
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [activeTab, setActiveTab] = useState<'dashboard' | 'library'>('dashboard');
  
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfile, setNewProfile] = useState<Partial<ServiceProfile>>({ name: '', port: 3000, serverIds: [] });

  useEffect(() => {
    loadData();
    
    // [修复] 获取监听器的返回值
    const removeStatusListener = window.ipcRenderer.on('profile-status', (_e: any, data: { profileId: string, status: 'online'|'offline', port?: number }) => {
      setStatuses(prev => ({
        ...prev,
        [data.profileId]: { ...prev[data.profileId], status: data.status, port: data.port }
      }));
    });

    return () => {
      // [关键修复] 加一层判断：只有当它真的是个函数时才调用
      // 这能兼容旧版 Preload 脚本，防止崩溃
      if (typeof removeStatusListener === 'function') {
        removeStatusListener();
      }
    };
  }, []);

  const loadData = async () => {
    try {
        const data = await window.ipcRenderer.invoke('db:get-all');
        setProfiles(data.profiles || {});
        setServers(data.servers || {});
        
        const initialLogs: Record<string, string[]> = {};
        if (data.profiles) {
            Object.keys(data.profiles).forEach(id => {
                if (!logs[id]) initialLogs[id] = [];
            });
            setLogs(prev => ({ ...initialLogs, ...prev }));
        }
    } catch (err) {
        console.error("Failed to load data:", err);
    }
  };

  const registerLogListener = (profileId: string) => {
    // 这里的 on 也是同样的道理，但因为是在 useEffect 依赖变化时调用，
    // 只要上面不崩，这里通常没事。但为了保险也可以不用清理（日志监听器常驻也可以接受，或者同样加检查）
    window.ipcRenderer.on(`log:${profileId}`, (_e: any, msg: string) => {
      setLogs(prev => ({
        ...prev,
        [profileId]: [...(prev[profileId] || []).slice(-99), msg]
      }));
    });
  };

  useEffect(() => {
    Object.keys(profiles).forEach(id => registerLogListener(id));
  }, [profiles]);

  const handleStart = async (id: string) => {
    setStatuses(prev => ({ ...prev, [id]: { ...prev[id], status: 'online' } })); 
    
    const res = await window.ipcRenderer.invoke('gateway:start', id);
    if (res.success) {
      setStatuses(prev => ({
        ...prev,
        [id]: { status: 'online', port: res.port, token: res.token }
      }));
    } else {
      alert('Failed: ' + res.error);
      setStatuses(prev => ({ ...prev, [id]: { ...prev[id], status: 'offline' } }));
    }
  };

  const handleStop = async (id: string) => {
    await window.ipcRenderer.invoke('gateway:stop', id);
  };

  const handleOpenBridge = (port: number, token?: string) => {
     if (!token) {
       alert("Waiting for token... Try again in a second.");
       return;
     }
     window.ipcRenderer.invoke('open-url', `http://127.0.0.1:${port}/bridge?token=${token}`);
  };

  const handleCreateProfile = async () => {
      const id = `profile-${Date.now()}`;
      const profile = { ...newProfile, id, color: getRandomColor() } as ServiceProfile;
      await window.ipcRenderer.invoke('db:save-profile', profile);
      setIsCreatingProfile(false);
      setNewProfile({ name: '', port: 3000 + Object.keys(profiles).length + 1, serverIds: [] });
      loadData();
  };

  const toggleServerInProfile = (serverId: string) => {
      const current = newProfile.serverIds || [];
      if (current.includes(serverId)) {
          setNewProfile({ ...newProfile, serverIds: current.filter(s => s !== serverId) });
      } else {
          setNewProfile({ ...newProfile, serverIds: [...current, serverId] });
      }
  };
  
  const handleDeleteProfile = async (id: string) => {
      if (confirm('Delete this profile?')) {
        await handleStop(id);
        await window.ipcRenderer.invoke('db:delete-profile', id);
        loadData();
      }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Segoe UI, sans-serif', background: '#f5f5f5', color: '#333' }}>
      <div style={{ width: 220, background: '#2c3e50', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 20, fontSize: 18, fontWeight: 'bold', borderBottom: '1px solid #34495e', display:'flex', alignItems:'center', gap:10 }}>
            <span>🕸</span> WebMCP
        </div>
        <div 
          onClick={() => setActiveTab('dashboard')}
          style={{ padding: '15px 20px', cursor: 'pointer', background: activeTab === 'dashboard' ? '#34495e' : 'transparent', display:'flex', gap:10 }}>
          📊 Dashboard
        </div>
        <div 
          onClick={() => setActiveTab('library')}
          style={{ padding: '15px 20px', cursor: 'pointer', background: activeTab === 'library' ? '#34495e' : 'transparent', display:'flex', gap:10 }}>
          📚 Library
        </div>
      </div>

      <div style={{ flex: 1, padding: 30, overflowY: 'auto' }}>
        {activeTab === 'dashboard' ? (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20 }}>
                 <h2 style={{ margin:0 }}>Active Instances</h2>
                 <button onClick={() => setIsCreatingProfile(true)} style={{ padding: '8px 16px', background: '#3498db', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>+ New Instance</button>
            </div>

            {isCreatingProfile && (
                <div style={{ background: 'white', padding: 20, borderRadius: 8, marginBottom: 20, boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                    <h3>Create New Instance</h3>
                    <div style={{ display:'flex', gap:20, marginBottom:15 }}>
                        <div style={{ flex:1 }}>
                            <label style={{ display:'block', fontSize:12, color:'#666', marginBottom:5 }}>Instance Name</label>
                            <input style={{ width:'100%', padding:8, boxSizing:'border-box' }} value={newProfile.name} onChange={e => setNewProfile({...newProfile, name: e.target.value})} placeholder="e.g. Python Workspace" />
                        </div>
                        <div style={{ width: 100 }}>
                            <label style={{ display:'block', fontSize:12, color:'#666', marginBottom:5 }}>Port</label>
                            <input type="number" style={{ width:'100%', padding:8, boxSizing:'border-box' }} value={newProfile.port} onChange={e => setNewProfile({...newProfile, port: parseInt(e.target.value)})} />
                        </div>
                    </div>
                    
                    <div style={{ marginBottom: 15 }}>
                        <label style={{ display:'block', fontSize:12, color:'#666', marginBottom:5 }}>Select Tools (MCP Servers)</label>
                        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                            {Object.values(servers).map(srv => (
                                <div 
                                    key={srv.id} 
                                    onClick={() => toggleServerInProfile(srv.id)}
                                    style={{ 
                                        padding: '6px 12px', borderRadius: 20, border: '1px solid', cursor:'pointer', fontSize:13,
                                        background: newProfile.serverIds?.includes(srv.id) ? '#e1f5fe' : 'white',
                                        borderColor: newProfile.serverIds?.includes(srv.id) ? '#3498db' : '#ddd',
                                        color: newProfile.serverIds?.includes(srv.id) ? '#3498db' : '#666'
                                    }}
                                >
                                    {srv.name}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
                        <button onClick={() => setIsCreatingProfile(false)} style={{ padding:'8px 16px', background:'white', border:'1px solid #ddd', borderRadius:4, cursor:'pointer' }}>Cancel</button>
                        <button onClick={handleCreateProfile} style={{ padding:'8px 16px', background:'#2ecc71', color:'white', border:'none', borderRadius:4, cursor:'pointer' }}>Create Instance</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
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
                  onOpenBridge={(port, token) => handleOpenBridge(port, token)}
                />
              ))}
            </div>
          </div>
        ) : (
          <Library servers={servers} onReload={loadData} />
        )}
      </div>
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
    <div style={{ background: 'white', borderRadius: 8, boxShadow: '0 2px 5px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position:'relative' }}>
      <div style={{ padding: 15, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `5px solid ${profile.color || '#ccc'}` }}>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: 16 }}>{profile.name}</div>
          <div style={{ fontSize: 12, color: '#888' }}>Port: {profile.port}</div>
        </div>
        <div style={{ 
          padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 'bold',
          background: isOnline ? '#e6fffa' : '#ffebe6', color: isOnline ? '#00b894' : '#d63031'
        }}>
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </div>
      </div>

      <button onClick={onDelete} style={{ position:'absolute', top:10, right:10, border:'none', background:'none', color:'#ccc', cursor:'pointer' }}>×</button>

      <div style={{ height: 180, background: '#1e1e1e', color: '#ccc', fontFamily: 'monospace', fontSize: 11, padding: 10, overflowY: 'auto' }} ref={scrollRef}>
        {logs.length === 0 && <div style={{ opacity: 0.5 }}>Logs will appear here...</div>}
        {logs.map((line: string, i: number) => (
          <div key={i} style={{ whiteSpace: 'pre-wrap', marginBottom: 2 }}>{line}</div>
        ))}
      </div>

      <div style={{ padding: 15, background: '#f9f9f9', display: 'flex', gap: 10 }}>
        {!isOnline ? (
          <button onClick={onStart} style={{ flex: 1, padding: '8px', background: '#0984e3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            ▶ Start
          </button>
        ) : (
          <>
            <button onClick={() => onOpenBridge(actualPort || profile.port, token)} style={{ flex: 1, padding: '8px', background: '#00b894', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              🌐 Open Bridge
            </button>
            <button onClick={onStop} style={{ width: 40, background: '#d63031', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              ⏹
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function getRandomColor() {
    const colors = ['#3498db', '#9b59b6', '#e67e22', '#16a085', '#2c3e50', '#e74c3c'];
    return colors[Math.floor(Math.random() * colors.length)];
}