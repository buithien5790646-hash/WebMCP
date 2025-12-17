import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { McpGateway, IGatewayLogger, IGatewayStorage, IRuntimeContext, ServerConfig } from '@webmcp/core'

// --- Interfaces for Type Safety ---
interface ServerDef {
  name?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: 'stdio' | 'sse' | 'http';
  url?: string;
  disabled?: boolean;
}

interface ProfileDef {
  name: string;
  port: number;
  serverIds: string[];
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
// -------------------------------------------------------------------
// 1. 实现 Logger (适配 Core 接口: appendLine)
// -------------------------------------------------------------------
const logger: IGatewayLogger = {
  info: (msg: string) => {
    console.log('[INFO]', msg)
    win?.webContents.send('log', { level: 'info', msg, timestamp: Date.now() })
  },
  error: (msg: string, error?: any) => {
    console.error('[ERROR]', msg, error || '')
    win?.webContents.send('log', { level: 'error', msg, error, timestamp: Date.now() })
  },
  appendLine: (msg: string) => {
    // console.log('[STREAM]', msg) 
    win?.webContents.send('log', { level: 'stream', msg, timestamp: Date.now() })
  }
}

// -------------------------------------------------------------------
// 2. 实现 Storage (适配 Core 接口: update)
// -------------------------------------------------------------------
import Store from 'electron-store'
const store = new Store<StoreSchema>()

const storage: IGatewayStorage = {
  get: (key: string) => Promise.resolve(store.get(key)),
  update: (key: string, value: any) => { 
    store.set(key, value);
    return Promise.resolve();
  }
}

// -------------------------------------------------------------------
// 3. 实现 RuntimeContext
// -------------------------------------------------------------------
const context: IRuntimeContext = {
  extensionPath: app.getAppPath(),
  getWorkspaceRoot: () => null // Desktop App typically has no single workspace root unless specified
}

// -------------------------------------------------------------------
// 4. 初始化 Core Gateway
// -------------------------------------------------------------------
const gateway = new McpGateway(logger, storage, context)

// -------------------------------------------------------------------
// 5. IPC Handlers
// -------------------------------------------------------------------

// Handle: Start Gateway
ipcMain.handle('gateway:start', async (_event, profileId: string) => {
  try {
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
          // Map Store definition to Core definition
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

    const config = {
        port: profile.port,
        mcpServers: mcpServers,
        allowedOrigins: [] // Default allow none (or logic in core)
    }

    // 3. Start & Get Result directly
    // Fix: use the return value from start() instead of getter methods
    const result = await gateway.start(config)
    
    return { status: 'success', port: result.port, token: result.token }
  } catch (err: any) {
    return { status: 'error', message: err.message }
  }
})

// Handle: Stop Gateway
ipcMain.handle('gateway:stop', async () => {
  await gateway.stop()
  return { status: 'stopped' }
})

// Handle: Get Store Value
ipcMain.handle('store:get', (_event, key: string) => {
  return store.get(key)
})

// Handle: Set Store Value
ipcMain.handle('store:set', (_event, key: string, val: any) => {
  store.set(key, val)
})

ipcMain.handle('open-external', (_event, url: string) => {
    shell.openExternal(url);
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

app.whenReady().then(createWindow)
