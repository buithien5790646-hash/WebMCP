import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import Store from 'electron-store'
import { McpGateway, IGatewayLogger, IGatewayStorage, IRuntimeContext, GatewayConfig } from '@webmcp/core'
import * as crypto from 'crypto';

// ----------------------------------------------------------------------
// 0. Type Definitions & Store Schema
// ----------------------------------------------------------------------

interface ServerDefinition {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

interface ServiceProfile {
  id: string;
  name: string;
  port: number;
  serverIds: string[];
  color?: string;
}

interface StoreSchema {
  servers: Record<string, ServerDefinition>;
  profiles: Record<string, ServiceProfile>;
}

const store = new Store<StoreSchema>({
  defaults: {
    servers: {
      'default-fs': {
        id: 'default-fs',
        name: 'Local Filesystem',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
      }
    },
    profiles: {
      'default-profile': {
        id: 'default-profile',
        name: 'Default Workspace',
        port: 34567,
        serverIds: ['default-fs'],
        color: '#3498db'
      }
    }
  }
});

// ----------------------------------------------------------------------
// 1. Gateway Runtime Manager
// ----------------------------------------------------------------------

class GatewayRuntime {
  private instances = new Map<string, { gateway: McpGateway, status: string }>();
  private mainWindow: BrowserWindow | null = null;

  setWindow(win: BrowserWindow) {
    this.mainWindow = win;
  }

  private createLogger(profileId: string): IGatewayLogger {
    return {
      info: (msg) => console.log(`[${profileId}] INFO: ${msg}`),
      error: (msg, err) => console.error(`[${profileId}] ERROR: ${msg}`, err),
      appendLine: (msg) => {
        if (this.mainWindow) this.mainWindow.webContents.send(`log:${profileId}`, msg);
      }
    };
  }

  private createStorage(): IGatewayStorage {
    return {
      get: async (key) => store.get(`runtime.${key}`),
      update: async (key, value) => store.set(`runtime.${key}`, value)
    };
  }

  private createContext(): IRuntimeContext {
    return {
      extensionPath: app.getAppPath(),
      getWorkspaceRoot: () => app.getPath('home')
    };
  }

  async startProfile(profileId: string) {
    const profile = store.get(`profiles.${profileId}`);
    if (!profile) throw new Error(`Profile ${profileId} not found`);

    const mcpServers: Record<string, any> = {};
    for (const srvId of profile.serverIds) {
      const srvDef = store.get(`servers.${srvId}`);
      if (srvDef) {
        mcpServers[srvDef.name] = {
          command: srvDef.command,
          args: srvDef.args,
          env: srvDef.env,
          type: srvDef.type,
          url: srvDef.url
        };
      }
    }

    if (this.instances.has(profileId)) {
      await this.stopProfile(profileId);
    }

    const gateway = new McpGateway(
      this.createLogger(profileId),
      this.createStorage(),
      this.createContext(),
      () => { this.broadcastStatus(profileId, 'offline'); },
      (status, port) => { this.broadcastStatus(profileId, status, port); }
    );

    try {
      const result = await gateway.start({
        port: profile.port,
        mcpServers,
        allowedOrigins: []
      });
      this.instances.set(profileId, { gateway, status: 'online' });
      return result;
    } catch (e) {
      this.instances.delete(profileId);
      throw e;
    }
  }

  async stopProfile(profileId: string) {
    const inst = this.instances.get(profileId);
    if (inst) {
      await inst.gateway.stop();
      this.instances.delete(profileId);
      this.broadcastStatus(profileId, 'offline');
    }
  }

  broadcastStatus(profileId: string, status: string, port?: number) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('profile-status', { profileId, status, port });
    }
  }
}

const runtime = new GatewayRuntime();

// ----------------------------------------------------------------------
// 2. Electron App Lifecycle
// ----------------------------------------------------------------------

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  runtime.setWindow(win);

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    // win.webContents.openDevTools() // DevTools disabled for cleaner startup
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.whenReady().then(() => {
  createWindow()

  ipcMain.handle('db:get-all', () => ({
      servers: store.get('servers'),
      profiles: store.get('profiles')
  }));

  ipcMain.handle('db:save-server', (_e, server: ServerDefinition) => {
    store.set(`servers.${server.id}`, server);
    return true;
  });

  ipcMain.handle('db:delete-server', (_e, id: string) => {
    store.delete(`servers.${id}` as any);
    return true;
  });

  ipcMain.handle('db:save-profile', (_e, profile: ServiceProfile) => {
    store.set(`profiles.${profile.id}`, profile);
    return true;
  });

  ipcMain.handle('db:delete-profile', (_e, id: string) => {
    store.delete(`profiles.${id}` as any);
    return true;
  });

  ipcMain.handle('gateway:start', async (_e, profileId: string) => {
    try {
      const res = await runtime.startProfile(profileId);
      return { success: true, ...res };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('gateway:stop', async (_e, profileId: string) => {
    await runtime.stopProfile(profileId);
    return { success: true };
  });

  ipcMain.handle('open-url', (_e, url: string) => {
    shell.openExternal(url);
  });
})
