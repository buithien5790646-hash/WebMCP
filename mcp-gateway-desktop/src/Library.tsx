import { useState } from 'react';
import { Trash2, Plus, Globe, Terminal, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Server Library</h2>
          <p className="text-muted-foreground">Manage reusable MCP server definitions.</p>
        </div>
        {!isAdding && (
            <Button onClick={() => setIsAdding(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Server
            </Button>
        )}
      </div>

      {isAdding && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Add New Server</CardTitle>
            <CardDescription>Define a local command or remote SSE endpoint.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Name</label>
                <Input 
                  placeholder="e.g. Docker Git" 
                  value={newServer.name || ''} 
                  onChange={e => setNewServer({...newServer, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <select 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newServer.type} 
                  onChange={e => setNewServer({...newServer, type: e.target.value as any})}
                >
                  <option value="stdio">STDIO (Local Command)</option>
                  <option value="sse">SSE (Remote URL)</option>
                </select>
              </div>
            </div>

            {newServer.type === 'stdio' ? (
              <>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Command</label>
                    <Input 
                        placeholder="e.g. npx, docker, python" 
                        value={newServer.command || ''} 
                        onChange={e => setNewServer({...newServer, command: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Arguments</label>
                    <Input 
                        placeholder="Space separated args (e.g. -y @server/filesystem)" 
                        value={argsStr} 
                        onChange={e => setArgsStr(e.target.value)}
                    />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">SSE URL</label>
                <Input 
                    placeholder="http://localhost:8080/sse" 
                    value={newServer.url || ''} 
                    onChange={e => setNewServer({...newServer, url: e.target.value})}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button onClick={handleSave}><Save className="mr-2 h-4 w-4"/> Save Definition</Button>
          </CardFooter>
        </Card>
      )}

      <div className="grid gap-3">
        {Object.values(servers).length === 0 && !isAdding && (
            <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                No servers defined yet. Click "Add Server" to get started.
            </div>
        )}
        
        {Object.values(servers).map(server => (
          <Card key={server.id} className="flex items-center justify-between p-4 hover:bg-accent/5 transition-colors">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                {server.type === 'stdio' ? <Terminal className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                    <span className="font-semibold">{server.name}</span>
                    <Badge variant="outline" className="text-[10px] h-5">{server.type.toUpperCase()}</Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1 font-mono">
                  {server.type === 'stdio' 
                    ? `$ ${server.command} ${(server.args || []).join(' ')}` 
                    : `🔗 ${server.url}`
                  }
                </div>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => handleDelete(server.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}