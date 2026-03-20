import { SessionManager } from './SessionManager';
import { GatewayClient } from './GatewayClient';
import { StorageService } from '../core/storage';
import { Messenger } from '../core/messenger';
import { HandshakeResponse, Session, ExtensionMessage } from '../types';

// === WebMCP Background Service (MV3 Persistent Edition) ===

// Initialization: Set default state
chrome.runtime.onInstalled.addListener(async () => {
  const syncKeys = ["autoSend", "autoPromptEnabled", "customSelectors", "user_rules"];
  const existingSync = await StorageService.getSync(syncKeys as any);
  const syncToSet: Record<string, any> = {};

  if (existingSync.autoSend === undefined) { syncToSet.autoSend = true; }
  if (existingSync.autoPromptEnabled === undefined) { syncToSet.autoPromptEnabled = false; }

  if (Object.keys(syncToSet).length > 0) {
    await StorageService.setSync(syncToSet);
    console.log("[WebMCP] Initialized user settings (Preserved existing)");
  }
});

// === Connection Logic & Security Fuse ===
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    if (!SessionManager.isUrlAllowed(changeInfo.url)) {
      const session = await SessionManager.getSession(tabId);
      if (session) {
        console.log(`[WebMCP] Security Fuse: Url changed to ${changeInfo.url}, revoking session.`);
        await SessionManager.removeSession(tabId);
        SessionManager.updateBadge(tabId, false);
        return;
      }
    }
  }

  if (changeInfo.status === "complete") {
    const session = await SessionManager.getSession(tabId);
    if (session && SessionManager.isUrlAllowed(tab.url)) {
      SessionManager.updateBadge(tabId, true);
      // [Sync] Restore connection state in Content Script after reload
      chrome.tabs.sendMessage(tabId, { type: "STATUS_UPDATE", connected: true, workspaceId: session.workspaceId }).catch(() => { });
      if (session.showLog) {
        chrome.tabs.sendMessage(tabId, { type: "TOGGLE_LOG", show: true }).catch(() => { });
      }
    } else if (session && !SessionManager.isUrlAllowed(tab.url)) {
      await SessionManager.removeSession(tabId);
      SessionManager.updateBadge(tabId, false);
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  SessionManager.removeSession(tabId);
});

// === Message Hub ===
Messenger.onMessage((request: ExtensionMessage, sender, sendResponse) => {
  const currentTabId = sender.tab ? sender.tab.id : null;

  if (request.type === "HANDSHAKE") {
    handleHandshake(request, currentTabId).then(sendResponse);
    return true;
  }

  if (request.type === "GET_STATUS") {
    const targetTabId = request.tabId || currentTabId;
    if (targetTabId) {
      SessionManager.getSession(targetTabId).then((session) => {
        sendResponse({
          connected: !!session,
          port: session?.port,
          showLog: session?.showLog || false,
          workspaceId: session?.workspaceId || 'global'
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
      SessionManager.updateSessionLog(targetTabId, show).then(() => {
        chrome.tabs.sendMessage(targetTabId, { type: "TOGGLE_LOG", show: show }).catch(() => { });
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
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: request.title || "WebMCP Notification",
      message: request.message || "Task Completed",
      priority: 2,
    });
    return true;
  }

  if (request.type === "SYNC_CONFIG") {
    sendResponse({ success: true });
    return true;
  }

  if (request.type === "CONNECT_EXISTING") {
    const targetTabId = request.tabId || currentTabId;
    if (!targetTabId) {
      sendResponse({ success: false, error: "Missing Tab ID" });
      return true;
    }

    chrome.storage.local.remove("session_null");

    if (request.port && request.token) {
      const workspaceId = request.workspaceId || "global";
      bindSession(targetTabId, request.port, request.token, workspaceId)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
    }
    return true;
  }
  return false;
});

// === Internal Logic Handlers ===

async function handleHandshake(request: any, tabId: number | null | undefined): Promise<HandshakeResponse> {
  const { port, token, force, workspaceId = 'global' } = request;

  if (!tabId) { return { success: false, error: "No Tab ID" }; }

  if (!force) {
    const all = await StorageService.getLocal(null);
    let conflictTabId: string | null = null;
    for (const [key, val] of Object.entries(all)) {
      if (
        key.startsWith("session_") &&
        (val as Session).port === port &&
        key !== `session_${tabId}`
      ) {
        conflictTabId = key.replace("session_", "");
        break;
      }
    }
    if (conflictTabId) {
      try {
        const tab = await chrome.tabs.get(parseInt(conflictTabId));
        if (tab) {
          return { success: false, error: "BUSY", conflictTabId };
        }
      } catch {
        await SessionManager.removeSession(parseInt(conflictTabId));
      }
    }
  }
  await bindSession(tabId, port, token, workspaceId);
  return { success: true };
}

async function bindSession(tabId: number, port: number, token: string, workspaceId: string) {
  await SessionManager.saveSession(tabId, { port, token, showLog: false, workspaceId });
  console.log(`[WebMCP] Tab ${tabId} bound to Port ${port} [Workspace: ${workspaceId}]`);
  SessionManager.updateBadge(tabId, true);
  // [Sync] Notify Content Script
  chrome.tabs.sendMessage(tabId, { type: "STATUS_UPDATE", connected: true, workspaceId }).catch(() => { });
  // Don't await, let it sync in the background
  GatewayClient.fetchInitDataFromGateway(port, token);
}

async function executeTool(request: any, tabId: number | null | undefined) {
  if (!tabId) { return { success: false, error: "No Session Tab" }; }

  const session = await SessionManager.getSession(tabId);
  if (!session) {
    return {
      success: false,
      error: "Session Lost. Please reconnect from VS Code.",
    };
  }

  return GatewayClient.executeTool(session.port, session.token, request.payload);
}
