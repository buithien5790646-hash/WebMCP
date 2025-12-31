import { app, BrowserWindow, ipcMain, shell, globalShortcut, Menu } from "electron";
import path from "node:path";
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
import { GatewayManager } from "./gateway-manager";
import type { ServerConfig } from "@webmcp/shared";
import Store from "electron-store";
import { MCPManager, EXAMPLE_SERVICES } from "@mcp-kit/core";

// Initialize MCP Market Kit Manager
const mcpManager = new MCPManager({
  rootDir: path.join(app.getPath("userData"), "mcp-market-data"),
  initialServices: EXAMPLE_SERVICES, // Inject example services here
});

// --- Interfaces for Type Safety ---
interface ServerDef {
  id: string;
  name: string;
  type: "stdio" | "sse" | "http";
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

interface AISiteConfig {
  name: string;
  address: string;
  browser?: string;
}

interface AppConfig {
  browser: string; // 'default', 'chrome', 'edge'
  aiSites: AISiteConfig[];
}

interface StoreSchema {
  profiles: Record<string, ProfileDef>;
  servers: Record<string, ServerDef>;
  config: AppConfig;
}

// ----------------------------------

process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, "../public");

let win: BrowserWindow | null;

const store = new Store<StoreSchema>({
  defaults: {
    profiles: {},
    servers: {},
    config: {
      browser: "default",
      aiSites: [
        { name: "Gemini", address: "https://gemini.google.com", },
        { name: "ChatGPT", address: "https://chatgpt.com" },
        { name: "DeepSeek", address: "https://chat.deepseek.com" },
      ],
    },
  },
});

// Manager Instances: profileId -> GatewayManager
const managers = new Map<string, GatewayManager>();

// -------------------------------------------------------------------
// 5. IPC Handlers
// -------------------------------------------------------------------

// Gateway: Start
ipcMain.handle("gateway:start", async (_event, profileId: string) => {
  try {
    // 0. Check existing
    if (managers.has(profileId)) {
      await managers.get(profileId)?.stop();
      managers.delete(profileId);
    }

    // 1. Load Profile Config
    const profiles = (store.get("profiles") || {}) as Record<string, ProfileDef>;
    const servers = (store.get("servers") || {}) as Record<string, ServerDef>;

    const profile = profiles[profileId];
    if (!profile) throw new Error(`Profile ${profileId} not found`);

    // 2. Construct Gateway Config
    const mcpServers: Record<string, ServerConfig> = {};

    if (Array.isArray(profile.serverIds)) {
      for (const srvId of profile.serverIds) {
        const srvDef = servers[srvId];
        if (srvDef) {
          mcpServers[srvDef.name || srvId] = {
            command: srvDef.command,
            args: srvDef.args,
            env: srvDef.env,
            type: srvDef.type || "stdio",
            url: srvDef.url,
            disabled: srvDef.disabled,
          };
        }
      }
    }

    // 3. Create Manager with specific Logger and workspaceId (profileId)
    const manager = new GatewayManager((msg) => {
      // Send logs specifically to this profile's channel
      win?.webContents.send(`log:${profileId}`, msg);
    }, profileId);

    managers.set(profileId, manager);

    // 4. Start
    const result = await manager.start({
      port: profile.port,
      mcpServers: mcpServers,
      allowedOrigins: [],
    });

    return { status: "success", port: result.port, token: result.token };
  } catch (err: any) {
    return { status: "error", message: err.message };
  }
});

// Gateway: Stop
ipcMain.handle("gateway:stop", async (_event, profileId: string) => {
  const manager = managers.get(profileId);
  if (manager) {
    await manager.stop();
    managers.delete(profileId);
  }
  return { status: "stopped" };
});

// DB: Get All Data
ipcMain.handle("db:get-all", () => {
  return {
    profiles: store.get("profiles") || {},
    servers: store.get("servers") || {},
  };
});

// DB: Profile Operations
ipcMain.handle("db:save-profile", (_event, profile: ProfileDef) => {
  store.set(`profiles.${profile.id}`, profile);
  return { success: true };
});

ipcMain.handle("db:delete-profile", (_event, id: string) => {
  store.delete(`profiles.${id}` as any);
  return { success: true };
});

// DB: Server Operations
ipcMain.handle("db:save-server", (_event, server: ServerDef) => {
  store.set(`servers.${server.id}`, server);
  return { success: true };
});

ipcMain.handle("db:delete-server", (_event, id: string) => {
  store.delete(`servers.${id}` as any);
  return { success: true };
});

// Config Operations
ipcMain.handle("config:get", () => store.get("config"));
ipcMain.handle("config:save", (_event, config: AppConfig) => {
  store.set("config", config);
  return { success: true };
});

// MCP Market Kit Operations
ipcMain.handle("market:get-services", async () => {
  try {
    const services = await mcpManager.getMarketplaceServices();
    return { status: "success", services };
  } catch (err: any) {
    return { status: "error", message: err.message };
  }
});

ipcMain.handle("market:install", async (_event, service: any) => {
  try {
    const success = await mcpManager.install(service);
    if (!success) throw new Error("Installation failed");

    // After installation, resolve the config to get the actual path
    const config = await mcpManager.resolve(service.id);
    return { status: "success", config };
  } catch (err: any) {
    return { status: "error", message: err.message };
  }
});

ipcMain.handle("market:is-installed", async (_event, serviceId: string) => {
  return mcpManager.isInstalled(serviceId);
});

ipcMain.handle("market:resolve", async (_event, serviceId: string, env?: Record<string, string>) => {
  try {
    const config = await mcpManager.resolve(serviceId, env);
    return { status: "success", config };
  } catch (err: any) {
    return { status: "error", message: err.message };
  }
});

// Utils with Browser Support
ipcMain.handle("open-url", (_event, url: string, browserMode: string = "default") => {
  const platform = process.platform;
  let command = "";

  if (browserMode === "default") {
    shell.openExternal(url);
    return;
  }

  // Browser Launch Logic (Ported from VS Code Extension)
  if (platform === "win32") {
    if (browserMode === "chrome") command = `start chrome "${url}"`;
    else if (browserMode === "edge") command = `start msedge "${url}"`;
  } else if (platform === "darwin") {
    if (browserMode === "chrome") command = `open -a "Google Chrome" "${url}"`;
    else if (browserMode === "edge") command = `open -a "Microsoft Edge" "${url}"`;
  } else {
    if (browserMode === "chrome") command = `google-chrome "${url}"`;
    else if (browserMode === "edge") command = `microsoft-edge "${url}"`;
    else command = `xdg-open "${url}"`;
  }

  if (command) {
    exec(command, (err) => {
      if (err) console.error(`Failed to open browser: ${err.message}`);
    });
  } else {
    shell.openExternal(url);
  }
});

// Environment Check
ipcMain.handle("gateway:test", async (_event, server: ServerDef) => {
  if (server.type === "sse") {
    try {
      const res = await fetch(server.url!);
      if (res.ok) return { status: "ok", message: "Connection successful" };
      return { status: "error", message: `HTTP Status: ${res.status}` };
    } catch (e: any) {
      return { status: "error", message: e.message };
    }
  } else {
    return new Promise((resolve) => {
      // Dry run via spawn
      const child = spawn(server.command!, server.args || [], {
        env: { ...process.env, ...server.env },
        shell: process.platform === "win32", // Use shell on Windows for compatibility
      });

      let stderr = "";
      let resolved = false;

      child.stderr?.on("data", (d) => {
        stderr += d.toString();
      });
      child.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          resolve({ status: "error", message: err.message });
        }
      });

      // If it stays alive for 2.5s, we consider it healthy
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill();
          resolve({ status: "ok", message: "Process started healthy" });
        }
      }, 2500);

      child.on("exit", (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            status: "error",
            message: `Process exited early (Code ${code}). ${stderr.slice(0, 200)}`,
          });
        }
      });
    });
  }
});

ipcMain.handle("env:check", async () => {
  const tools = ["node", "npx", "docker", "git", "python3", "uv"];
  const results: Record<string, boolean> = {};

  for (const tool of tools) {
    try {
      const cmd = process.platform === "win32" ? `where ${tool}` : `command -v ${tool}`;
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
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: true,
    },
  });

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST || "", "index.html"));
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  // Register F12 to open DevTools
  globalShortcut.register("F12", () => {
    win?.webContents.toggleDevTools();
  });
  globalShortcut.register("CommandOrControl+Shift+I", () => {
    win?.webContents.toggleDevTools();
  });
});
