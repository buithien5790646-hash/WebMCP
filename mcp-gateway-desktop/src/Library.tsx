import { useState } from 'react';

interface ServerDefinition {
  id: string;
  name: string;
  type: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

interface Props {
  servers: Record<string, ServerDefinition>;
  onReload: () => void;
}

export default function Library({ servers, onReload }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newServer, setNewServer] = useState<Partial<ServerDefinition>>({
    type: 'stdio',
    command: '',
    args: []
  });
  const [argsStr, setArgsStr] = useState('');

  const handleSave = async () => {
    const id = newServer.id || `server-${Date.now()}`;
    const serverToSave = {
      ...newServer,
      id,
      args: argsStr.split(' ').filter(s => s.trim().length > 0)
    };

    await window.ipcRenderer.invoke('db:save-server', serverToSave);
    setIsAdding(false);
    setNewServer({ type: 'stdio', command: '', args: [] });
    setArgsStr('');
    onReload();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this server?')) {
      await window.ipcRenderer.invoke('db:delete-server', id);
      onReload();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>📚 Server Library</h2>
        <button 
          onClick={() => setIsAdding(true)}
          style={{ padding: '8px 16px', background: '#3498db', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          + Add Server
        </button>
      </div>

      {isAdding && (
        <div style={{ background: 'white', padding: 20, borderRadius: 8, marginBottom: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3>New Server Definition</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input 
              placeholder="Display Name (e.g. Docker Git)" 
              value={newServer.name || ''} 
              onChange={e => setNewServer({...newServer, name: e.target.value})}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
            />
            <select 
              value={newServer.type} 
              onChange={e => setNewServer({...newServer, type: e.target.value as any})}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
            >
              <option value="stdio">STDIO (Local Command)</option>
              <option value="sse">SSE (Remote URL)</option>
            </select>
          </div>

          {newServer.type === 'stdio' ? (
            <>
              <input 
                placeholder="Command (e.g. npx, docker, python)" 
                value={newServer.command || ''} 
                onChange={e => setNewServer({...newServer, command: e.target.value})}
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd', marginBottom: 10, boxSizing: 'border-box' }}
              />
              <input 
                placeholder="Arguments (space separated, e.g. -y @modelcontextprotocol/server-filesystem)" 
                value={argsStr} 
                onChange={e => setArgsStr(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd', marginBottom: 10, boxSizing: 'border-box' }}
              />
            </>
          ) : (
            <input 
              placeholder="SSE URL (e.g. http://localhost:8080/sse)" 
              value={newServer.url || ''} 
              onChange={e => setNewServer({...newServer, url: e.target.value})}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd', marginBottom: 10, boxSizing: 'border-box' }}
            />
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setIsAdding(false)} style={{ padding: '8px 16px', border: '1px solid #ddd', background: 'white', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} style={{ padding: '8px 16px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save Definition</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {Object.values(servers).map(server => (
          <div key={server.id} style={{ background: 'white', padding: 15, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #eee' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>{server.name} <span style={{ fontSize: 10, background: '#eee', padding: '2px 6px', borderRadius: 4 }}>{server.type}</span></div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                {server.type === 'stdio' 
                  ? `$ ${server.command} ${(server.args || []).join(' ')}` 
                  : `🔗 ${server.url}`
                }
              </div>
            </div>
            <button 
              onClick={() => handleDelete(server.id)}
              style={{ color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}