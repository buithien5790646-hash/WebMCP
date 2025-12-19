import { HandshakeResponse } from '@/types';
import { apiClient } from '@/services/api';
import { browserService, messageBroker } from '@/services';
import { sessionManager, configManager, toolManager } from './managers';

// === WebMCP Background Service (MV3 Persistent Edition) ===

// 1. 初始化
browserService.onInstalled(async () => {
  await configManager.initializeStorage();
  console.log("[WebMCP] Extension initialized");
});

// 2. 消息路由注册
messageBroker.on("HANDSHAKE", (req, sender, sendResponse) => {
  handleHandshake(req, sender.tab?.id).then(sendResponse);
  return true;
});

messageBroker.on("GET_STATUS", (req, sender, sendResponse) => {
  const targetTabId = req.tabId || sender.tab?.id;
  if (targetTabId) {
    sessionManager.getSession(targetTabId).then((session) => {
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
});

messageBroker.on("SET_LOG_VISIBLE", (req, _sender, sendResponse) => {
  const targetTabId = req.tabId;
  const show = req.show ?? false;
  if (targetTabId) {
    sessionManager.updateSessionLog(targetTabId, show).then(() => {
      browserService.sendMessage({ type: "TOGGLE_LOG", show: show }, targetTabId).catch(() => { });
      sendResponse({ success: true });
    });
  }
  return true;
});

messageBroker.on("EXECUTE_TOOL", (req, sender, sendResponse) => {
  executeTool(req, sender.tab?.id).then(sendResponse);
  return true;
});

messageBroker.on("SHOW_NOTIFICATION", (req) => {
  browserService.createNotification({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: req.title || "WebMCP Notification",
    message: req.message || "Task Completed",
    priority: 2,
  });
});

messageBroker.on("SYNC_CONFIG", (_req, _sender, sendResponse) => {
  configManager.pushConfigToGateway().then(success => sendResponse({ success }));
  return true;
});

messageBroker.on("CONNECT_EXISTING", (req, sender, sendResponse) => {
  const targetTabId = req.tabId || sender.tab?.id;
  if (!targetTabId) {
    sendResponse({ success: false, error: "Missing Tab ID" });
    return true;
  }
  sessionManager.clearNullSession();
  if (req.port && req.token) {
    bindSession(targetTabId, req.port, req.token)
      .then(() => sendResponse({ success: true }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
  }
  return true;
});

// 3. Tab 状态追踪 (安全熔断与连接恢复)
browserService.onTabsUpdated(async (tabId, changeInfo, tab) => {
  // 1. 如果 URL 发生变化，立即校验安全性
  if (changeInfo.url || (changeInfo.status === 'loading' && tab.url)) {
    const targetUrl = changeInfo.url || tab.url;
    if (targetUrl && !configManager.isUrlAllowed(targetUrl)) {
      const session = await sessionManager.getSession(tabId);
      if (session) {
        console.warn(`[WebMCP] Security Fuse: Navigation to unauthorized URL ${targetUrl}. Revoking session.`);
        await sessionManager.removeSession(tabId);
      }
    }
  }

  // 2. 加载完成后的同步逻辑
  if (changeInfo.status === "complete") {
    const session = await sessionManager.getSession(tabId);
    if (session) {
      if (configManager.isUrlAllowed(tab.url)) {
        sessionManager.updateBadge(tabId, true);
        // [Sync] Restore connection state
        browserService.sendMessage({ type: "STATUS_UPDATE", connected: true }, tabId).catch(() => { });
        if (session.showLog) {
          browserService.sendMessage({ type: "TOGGLE_LOG", show: true }, tabId).catch(() => { });
        }
      } else {
        console.warn(`[WebMCP] Post-load security check failed for ${tab.url}. Removing session.`);
        await sessionManager.removeSession(tabId);
      }
    }
  }
});

// === 逻辑实现 (协调层) ===
async function handleHandshake(request: any, tabId: number | null | undefined): Promise<HandshakeResponse> {
  const { port, token, force } = request;
  if (!tabId) return { success: false, error: "No Tab ID" };

  if (!force) {
    const conflictTabId = await sessionManager.findConflictTabId(port, tabId);
    if (conflictTabId) {
      try {
        const tab = await browserService.getTab(parseInt(conflictTabId));
        if (tab) {
          return { success: false, error: "BUSY", conflictTabId };
        }
      } catch (e) {
        await sessionManager.removeSession(parseInt(conflictTabId));
      }
    }
  }
  await bindSession(tabId, port, token);
  return { success: true };
}

async function bindSession(tabId: number, port: number, token: string) {
  await sessionManager.saveSession(tabId, { port, token, showLog: false });
  console.log(`[WebMCP] Tab ${tabId} bound to Port ${port}`);
  sessionManager.updateBadge(tabId, true);

  // Configure ApiClient
  apiClient.configure(port, token);

  // [Sync] Notify Content Script
  browserService.sendMessage({ type: "STATUS_UPDATE", connected: true }, tabId).catch(() => { });

  await configManager.syncConfigFromGateway();
  await toolManager.prefetchToolList();
}

async function executeTool(request: any, tabId: number | null | undefined) {
  if (!tabId) return { success: false, error: "No Session Tab" };
  const session = await sessionManager.getSession(tabId);
  if (!session) {
    return { success: false, error: "Session Lost. Please reconnect from VS Code." };
  }

  if (!apiClient.isConfigured()) {
    apiClient.configure(session.port, session.token);
  }

  return await toolManager.executeTool(request.payload.name, request.payload.arguments);
}

browserService.onTabsRemoved((tabId) => {
  sessionManager.removeSession(tabId);
});
