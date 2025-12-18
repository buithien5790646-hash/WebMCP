import { app, BrowserWindow, ipcMain, shell, globalShortcut } from 'electron'
import path from 'node:path'
import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)
import { GatewayManager, ServerConfig } from './gateway-manager'
import Store from 'electron-store'

// --- Interfaces for Type Safety ---
interface ServerDef {
  id: string;
  name: string;
  type: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  disabled?: boolean;
}

interface ProfileDef {
  id: string;
  name: string;
  port: number;
  serverIds: string[];
  color?: string;
}

interface StoreSchema {
  profiles: Record<string, ProfileDef>;
  servers: Record<string, ServerDef>;
}

// ----------------------------------

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged 
  ? process.env.DIST 
  : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null

const store = new Store<StoreSchema>()

// Manager Instances: profileId -> GatewayManager
const managers = new Map<string, GatewayManager>();

// -------------------------------------------------------------------
// 5. IPC Handlers
// -------------------------------------------------------------------

// Gateway: Start
ipcMain.handle('gateway:start', async (_event, profileId: string) => {
  try {
    // 0. Check existing
    if (managers.has(profileId)) {
        await managers.get(profileId)?.stop();
        managers.delete(profileId);
    }

    // 1. Load Profile Config
    const profiles = (store.get('profiles') || {}) as Record<string, ProfileDef>
    const servers = (store.get('servers') || {}) as Record<string, ServerDef>

    const profile = profiles[profileId]
    if (!profile) throw new Error(`Profile ${profileId} not found`)

    // 2. Construct Gateway Config
    const mcpServers: Record<string, ServerConfig> = {}
    
    if (Array.isArray(profile.serverIds)) {
      for (const srvId of profile.serverIds) {
        const srvDef = servers[srvId]
        if (srvDef) {
          mcpServers[srvDef.name || srvId] = {
            command: srvDef.command,
            args: srvDef.args,
            env: srvDef.env,
            type: srvDef.type || 'stdio',
            url: srvDef.url,
            disabled: srvDef.disabled
          }
        }
      }
    }

    // 3. Create Manager with specific Logger
    const manager = new GatewayManager((msg) => {
        // Send logs specifically to this profile's channel
        win?.webContents.send(`log:${profileId}`, msg);
    });

    managers.set(profileId, manager);

    // 4. Start
    const result = await manager.start({
        port: profile.port,
        mcpServers: mcpServers,
        allowedOrigins: []
    });
    
    return { status: 'success', port: result.port, token: result.token }
  } catch (err: any) {
    return { status: 'error', message: err.message }
  }
})

// Gateway: Stop
ipcMain.handle('gateway:stop', async (_event, profileId: string) => {
  const manager = managers.get(profileId);
  if (manager) {
      await manager.stop();
      managers.delete(profileId);
  }
  return { status: 'stopped' }
})

// DB: Get All Data
ipcMain.handle('db:get-all', () => {
  return {
    profiles: store.get('profiles') || {},
    servers: store.get('servers') || {}
  }
})

// DB: Profile Operations
ipcMain.handle('db:save-profile', (_event, profile: ProfileDef) => {
  store.set(`profiles.${profile.id}`, profile)
  return { success: true }
})

ipcMain.handle('db:delete-profile', (_event, id: string) => {
  store.delete(`profiles.${id}` as any)
  return { success: true }
})

// DB: Server Operations
ipcMain.handle('db:save-server', (_event, server: ServerDef) => {
  store.set(`servers.${server.id}`, server)
  return { success: true }
})

ipcMain.handle('db:delete-server', (_event, id: string) => {
  store.delete(`servers.${id}` as any)
  return { success: true }
})

// Utils
ipcMain.handle('open-url', (_event, url: string) => {
    shell.openExternal(url);
});

// Environment Check
ipcMain.handle('gateway:test', async (_event, server: ServerDef) => {
  if (server.type === 'sse') {
    try {
      const res = await fetch(server.url!);
      if (res.ok) return { status: 'ok', message: 'Connection successful' };
      return { status: 'error', message: `HTTP Status: ${res.status}` };
    } catch (e: any) {
      return { status: 'error', message: e.message };
    }
  } else {
    return new Promise((resolve) => {
      // Dry run via spawn
      const child = spawn(server.command!, server.args || [], {
        env: { ...process.env, ...server.env },
        shell: process.platform === 'win32' // Use shell on Windows for compatibility
      });
      
      let stderr = '';
      let resolved = false;

      child.stderr?.on('data', (d) => { stderr += d.toString() });
      child.on('error', (err) => {
        if (!resolved) { resolved = true; resolve({ status: 'error', message: err.message }); }
      });

      // If it stays alive for 2.5s, we consider it healthy
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill();
          resolve({ status: 'ok', message: 'Process started healthy' });
        }
      }, 2500);

      child.on('exit', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({ 
            status: 'error', 
            message: `Process exited early (Code ${code}). ${stderr.slice(0, 200)}` 
          });
        }
      });
    });
  }
});

ipcMain.handle('env:check', async () => {
  const tools = ['node', 'npx', 'docker', 'git', 'python3', 'uv'];
  const results: Record<string, boolean> = {};
  
  for (const tool of tools) {
    try {
      const cmd = process.platform === 'win32' ? `where ${tool}` : `command -v ${tool}`;
      await execAsync(cmd);
      results[tool] = true;
    } catch {
      results[tool] = false;
    }
  }
  return results;
});

// -------------------------------------------------------------------
// Electron Boilerplate
// -------------------------------------------------------------------
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: true,
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()
  
  // Register F12 to open DevTools
  globalShortcut.register('F12', () => {
    win?.webContents.toggleDevTools()
  })
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    win?.webContents.toggleDevTools()
  })
})
