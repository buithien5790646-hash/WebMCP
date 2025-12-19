import { Session, MessageRequest, HandshakeResponse } from '@/types';
import { apiClient } from '@/services/api';
import { getLocal, setLocal, getSync, setSync, removeLocal } from '@/services/storage';
import { browserService } from '@/services/BrowserService';

// === WebMCP Background Service (MV3 Persistent Edition) ===

// 初始化：加载多语言资源文件
browserService.onInstalled(async () => {
  const files: Record<string, string> = {
    prompt_en: "prompt.md",
    prompt_zh: "prompt_zh.md",
    train_en: "train.md",
    train_zh: "train_zh.md",
    error_en: "error_hint.md",
    error_zh: "error_hint_zh.md",
  };

  const storageData: Record<string, string> = {};

  // 使用 fetch 读取扩展内的 .md 文件
  for (const [key, file] of Object.entries(files)) {
    try {
      const url = browserService.getURL(file);
      const response = await fetch(url);
      if (response.ok) {
        storageData[key] = await response.text();
      } else {
        console.error(`Failed to load ${file}`);
      }
    } catch (err) {
      console.error(`Error loading ${file}`, err);
    }
  }

  // 1. 初始化本地资源 (storage.local)
  const existingLocal = await getLocal(Object.keys(storageData) as any);
  const localToSet: Record<string, string> = {};
  for (const [key, val] of Object.entries(storageData)) {
    if (!(existingLocal as any)[key]) {
      localToSet[key] = val;
    }
  }
  if (Object.keys(localToSet).length > 0) {
    await setLocal(localToSet as any);
    console.log("[WebMCP] Initialized local resources");
  }

  // 2. 初始化用户配置 (storage.sync)
  const syncKeys = ["autoSend", "autoPromptEnabled", "protected_tools"];
  const existingSync = await getSync(syncKeys as any);
  const syncToSet: Record<string, any> = {};

  if (existingSync.autoSend === undefined) syncToSet.autoSend = true;
  if (existingSync.autoPromptEnabled === undefined) syncToSet.autoPromptEnabled = false;

  if (Object.keys(syncToSet).length > 0) {
    await setSync(syncToSet as any);
    console.log("[WebMCP] Initialized user settings (Preserved existing)");
  }
});

// === 工具函数：检查 URL 是否在白名单 ===
function isUrlAllowed(url: string | undefined): boolean {
  if (!url) return false;
  const manifest = browserService.getManifest();

  const hostPatterns = manifest.host_permissions || [];
  const scriptPatterns = (manifest.content_scripts || []).flatMap(
    (cs) => cs.matches || []
  );
  const allPatterns = [...new Set([...hostPatterns, ...scriptPatterns])];

  return allPatterns.some((pattern) => {
    const base = pattern.replace(/\*$/, "");
    return url.startsWith(base) || url === base.replace(/\/$/, "");
  });
}

// === 保持连接逻辑 & 安全熔断 ===
browserService.onTabsUpdated(async (tabId, changeInfo, tab) => {
  // 1. 如果 URL 发生变化，立即校验安全性
  if (changeInfo.url || (changeInfo.status === 'loading' && tab.url)) {
    const targetUrl = changeInfo.url || tab.url;
    if (targetUrl && !isUrlAllowed(targetUrl)) {
      const session = await getSession(tabId);
      if (session) {
        console.warn(`[WebMCP] Security Fuse: Navigation to unauthorized URL ${targetUrl}. Revoking session.`);
        await removeSession(tabId);
        updateBadge(tabId, false);
      }
    }
  }

  // 2. 加载完成后的同步逻辑
  if (changeInfo.status === "complete") {
    const session = await getSession(tabId);
    if (session) {
      if (isUrlAllowed(tab.url)) {
        updateBadge(tabId, true);
        // [Sync] Restore connection state
        browserService.sendMessage({ type: "STATUS_UPDATE", connected: true }, tabId).catch(() => { });
        if (session.showLog) {
          browserService.sendMessage({ type: "TOGGLE_LOG", show: true }, tabId).catch(() => { });
        }
      } else {
        console.warn(`[WebMCP] Post-load security check failed for ${tab.url}. Removing session.`);
        await removeSession(tabId);
        updateBadge(tabId, false);
      }
    }
  }
});

// === 消息处理中心 ===
browserService.onMessage((request: MessageRequest, sender, sendResponse) => {
  const currentTabId = sender.tab ? sender.tab.id : null;

  if (request.type === "HANDSHAKE") {
    handleHandshake(request, currentTabId).then(sendResponse);
    return true;
  }
  if (request.type === "GET_STATUS") {
    // Support both external (Popup) and internal (Content Script) status checks
    const targetTabId = request.tabId || (sender.tab ? sender.tab.id : null);
    if (targetTabId) {
      getSession(targetTabId).then((session) => {
        sendResponse({
          connected: !!session,
          port: session?.port,
          showLog: session?.showLog || false,
        });
      });
    } else {
      sendResponse({ connected: false, error: "Unknown Tab ID" });
    }
    return true;
  }
  if (request.type === "SET_LOG_VISIBLE") {
    const targetTabId = request.tabId;
    const show = request.show ?? false;
    if (targetTabId) {
      updateSessionLog(targetTabId, show).then(() => {
        browserService.sendMessage({ type: "TOGGLE_LOG", show: show }, targetTabId).catch(() => { });
        sendResponse({ success: true });
      });
    }
    return true;
  }
  if (request.type === "EXECUTE_TOOL") {
    executeTool(request, currentTabId).then(sendResponse);
    return true;
  }

  if (request.type === "SHOW_NOTIFICATION") {
    browserService.createNotification({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: request.title || "WebMCP Notification",
      message: request.message || "Task Completed",
      priority: 2,
    });
    return true;
  }
  if (request.type === "SYNC_CONFIG") {
    pushConfigToGateway().then(success => sendResponse({ success }));
    return true;
  }
  if (request.type === "CONNECT_EXISTING") {
    const targetTabId = request.tabId || currentTabId;
    if (!targetTabId) {
      sendResponse({ success: false, error: "Missing Tab ID" });
      return true;
    }

    removeLocal("session_null" as any);

    if (request.port && request.token) {
      bindSession(targetTabId, request.port, request.token)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
    }
    return true;
  }
  return false;
});

// === 数据层 ===
async function getSession(tabId: number): Promise<Session | undefined> {
  const key = `session_${tabId}`;
  const result = await getLocal(key as any);
  return (result as any)[key];
}

async function saveSession(tabId: number, data: Session) {
  const key = `session_${tabId}`;
  await setLocal({ [key]: data } as any);
}

async function updateSessionLog(tabId: number, showLog: boolean) {
  const session = await getSession(tabId);
  if (session) {
    session.showLog = showLog;
    await saveSession(tabId, session);
  }
}

async function removeSession(tabId: number) {
  const key = `session_${tabId}`;
  await removeLocal(key);
  // [Sync] Notify Content Script
  browserService.sendMessage({ type: "STATUS_UPDATE", connected: false }, tabId).catch(() => { });
}

// === 逻辑实现 ===
async function handleHandshake(request: any, tabId: number | null | undefined): Promise<HandshakeResponse> {
  const { port, token, force } = request;

  if (!tabId) return { success: false, error: "No Tab ID" };

  if (!force) {
    const all = await getLocal(null);
    const entries = Object.entries(all || {});
    let conflictTabId: string | null = null;
    for (const [key, val] of entries) {
      const sessionData = val as any as Session;
      if (
        key.startsWith("session_") &&
        sessionData.port === port &&
        key !== `session_${tabId}`
      ) {
        conflictTabId = key.replace("session_", "");
        break;
      }
    }
    if (conflictTabId) {
      try {
        const tab = await browserService.getTab(parseInt(conflictTabId));
        if (tab) {
          return { success: false, error: "BUSY", conflictTabId };
        }
      } catch (e) {
        await removeSession(parseInt(conflictTabId));
      }
    }
  }
  await bindSession(tabId, port, token);
  return { success: true };
}

async function bindSession(tabId: number, port: number, token: string) {
  await saveSession(tabId, { port, token, showLog: false });
  console.log(`[WebMCP] Tab ${tabId} bound to Port ${port}`);
  updateBadge(tabId, true);
  // Configure ApiClient
  apiClient.configure(port, token);
  // [Sync] Notify Content Script
  browserService.sendMessage({ type: "STATUS_UPDATE", connected: true }, tabId).catch(() => { });
  await syncConfigFromGateway();
  prefetchToolList();
}

// === 配置同步 (Host Sync) ===
async function pushConfigToGateway() {
  try {
    if (!apiClient.isConfigured()) return false;

    // Gather config
    const syncData = await getSync(["protected_tools", "autoSend", "autoPromptEnabled"] as any);
    const localKeys = ["prompt_en", "prompt_zh", "train_en", "train_zh", "error_en", "error_zh", "user_rules"];
    const localData = await getLocal(localKeys as any);

    const fullConfig = {
      version: 1,
      timestamp: new Date().toISOString(),
      sync: syncData,
      local: localData
    };

    // Push using ApiClient
    await apiClient.pushConfig(fullConfig);
    console.log("[WebMCP] Config pushed to Gateway (Auto-Save)");
    return true;
  } catch (e) {
    console.error("[WebMCP] Failed to push config:", e);
    return false;
  }
}

async function prefetchToolList() {
  try {
    if (!apiClient.isConfigured()) return;

    console.log("[WebMCP] Prefetching tool list...");
    const json = await apiClient.getTools();

    // Parse Grouped Data
    const rawGroups = json.groups || [];
    const newToolNames: string[] = [];

    rawGroups.forEach((g: any) => {
      if (g.tools) g.tools.forEach((t: any) => newToolNames.push(t.name));
      if (g.hidden_tools) g.hidden_tools.forEach((n: string) => newToolNames.push(n));
    });

    // [HITL] Security: Auto-protect new tools logic
    const localData = await getLocal(["cached_tool_list"] as any);
    const syncData = await getSync(["protected_tools"] as any);

    const knownTools = new Set(localData.cached_tool_list || []);
    const protectedTools = new Set(syncData.protected_tools || []);
    let protectedDirty = false;

    newToolNames.forEach((tName: string) => {
      // If it's a NEW tool (not in cache), protect it by default
      if (!knownTools.has(tName)) {
        if (!protectedTools.has(tName)) {
          protectedTools.add(tName);
          protectedDirty = true;
        }
      }
    });

    if (protectedDirty) {
      await setSync({
        protected_tools: Array.from(protectedTools),
      } as any);
      console.log("[WebMCP] New tools detected & protected during prefetch.");
    }

    await setLocal({
      cached_tool_list: newToolNames,
      cached_tool_groups: rawGroups
    } as any);
    console.log("[WebMCP] Tool list cached.");
  } catch (e) {
    console.error("[WebMCP] Tool prefetch failed:", e);
  }
}

async function syncConfigFromGateway() {
  try {
    if (!apiClient.isConfigured()) return;

    console.log("[WebMCP] Syncing config from Gateway...");
    const config = await apiClient.pullConfig();

    if (config) {
      console.log("[WebMCP] Remote config found. Overwriting local settings.");
      const { sync, local } = config;

      if (sync) {
        await setSync(sync);
      }
      if (local) {
        // 仅恢复提示词等关键数据，不覆盖 Session
        const safeLocal: Record<string, string> = {};
        const keys = ["prompt_en", "prompt_zh", "train_en", "train_zh", "error_en", "error_zh", "user_rules"];
        keys.forEach(k => {
          if (local[k]) safeLocal[k] = local[k];
        });
        if (Object.keys(safeLocal).length > 0) {
          await setLocal(safeLocal as any);
        }
      }
    } else {
      console.log("[WebMCP] No remote config. Keeping local defaults.");
    }
  } catch (e) {
    console.error("[WebMCP] Config sync failed:", e);
  }
}

function updateBadge(tabId: number, active: boolean) {
  if (active) {
    browserService.setBadgeText("ON", tabId);
    browserService.setBadgeBackgroundColor("#4CAF50", tabId);
  } else {
    browserService.setBadgeText("", tabId);
  }
}

async function executeTool(request: any, tabId: number | null | undefined) {
  if (!tabId) return { success: false, error: "No Session Tab" };
  const session = await getSession(tabId);
  if (!session) {
    return {
      success: false,
      error: "Session Lost. Please reconnect from VS Code.",
    };
  }

  // Configure ApiClient if not already configured
  if (!apiClient.isConfigured()) {
    apiClient.configure(session.port, session.token);
  }

  try {
    const textContent = await apiClient.executeTool(
      request.payload.name,
      request.payload.arguments || {}
    );
    return { success: true, data: textContent };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

browserService.onTabsRemoved((tabId) => {
  removeSession(tabId);
});