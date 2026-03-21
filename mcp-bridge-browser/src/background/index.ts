import { SessionManager } from './SessionManager';
import { GatewayClient } from './GatewayClient';
import { StorageService } from '../core/storage';
import { Messenger } from '../core/messenger';
import { HandshakeResponse, Session, ExtensionMessage } from '../types';

// === WebMCP 后台服务 (Manifest V3 持续运行版) ===

/**
 * 扩展安装/更新时的初始化逻辑：设置同步存储的默认值
 */
chrome.runtime.onInstalled.addListener(async () => {
  const syncKeys = ["autoSend", "autoPromptEnabled", "customSelectors", "user_rules"];
  const existingSync = await StorageService.getSync(syncKeys as any);
  const syncToSet: Record<string, any> = {};

  // 如果同步存储中没有这些设置，则写入默认值
  if (existingSync.autoSend === undefined) { syncToSet.autoSend = true; }
  if (existingSync.autoPromptEnabled === undefined) { syncToSet.autoPromptEnabled = false; }

  // 仅保存确实需要设置的默认值，保留用户已有的配置
  if (Object.keys(syncToSet).length > 0) {
    await StorageService.setSync(syncToSet);
    console.log("[WebMCP] Initialized user settings (Preserved existing)");
  }
});

// === 连接逻辑与安全保险丝机制 ===
// 监听标签页更新（如 URL 变化、页面加载完成）
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 当标签页的 URL 发生变化时，检查该 URL 是否在允许的列表中
  if (changeInfo.url) {
    if (!SessionManager.isUrlAllowed(changeInfo.url)) {
      const session = await SessionManager.getSession(tabId);
      if (session) {
        // 安全保险丝：若 URL 变成不允许的域名，则吊销此会话
        console.log(`[WebMCP] Security Fuse: Url changed to ${changeInfo.url}, revoking session.`);
        await SessionManager.removeSession(tabId);
        SessionManager.updateBadge(tabId, false);
        return;
      }
    }
  }

  // 页面加载完成后的逻辑处理
  if (changeInfo.status === "complete") {
    const session = await SessionManager.getSession(tabId);
    if (session && SessionManager.isUrlAllowed(tab.url)) {
      SessionManager.updateBadge(tabId, true);
      // [同步] 页面刷新后恢复 Content Script 的连接状态
      chrome.tabs.sendMessage(tabId, { type: "STATUS_UPDATE", connected: true, workspaceId: session.workspaceId }).catch(() => { });
      // 如果当前会话开启了日志，则通知 Content Script 显示日志
      if (session.showLog) {
        chrome.tabs.sendMessage(tabId, { type: "TOGGLE_LOG", show: true }).catch(() => { });
      }
    } else if (session && !SessionManager.isUrlAllowed(tab.url)) {
      // 页面加载完成但 URL 不被允许，移除会话
      await SessionManager.removeSession(tabId);
      SessionManager.updateBadge(tabId, false);
    }
  }
});

/**
 * 标签页关闭时自动清理对应的会话数据
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  SessionManager.removeSession(tabId);
});

// === 消息分发中心 ===
// 处理来自 Content Script 或 Popup 的消息
Messenger.onMessage((request: ExtensionMessage, sender, sendResponse) => {
  const currentTabId = sender.tab ? sender.tab.id : null;

  // 处理网关握手请求
  if (request.type === "HANDSHAKE") {
    handleHandshake(request, currentTabId).then(sendResponse);
    return true; // 保持通道开放，异步发送响应
  }

  // 获取当前状态
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

  // 切换日志窗口可见性
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

  // 执行工具请求
  if (request.type === "EXECUTE_TOOL") {
    executeTool(request, currentTabId).then(sendResponse);
    return true;
  }

  // 显示系统通知
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

  // 同步配置请求
  if (request.type === "SYNC_CONFIG") {
    sendResponse({ success: true });
    return true;
  }

  // 连接已存在的会话 (用于从弹窗建立连接等)
  if (request.type === "CONNECT_EXISTING") {
    const targetTabId = request.tabId || currentTabId;
    if (!targetTabId) {
      sendResponse({ success: false, error: "Missing Tab ID" });
      return true;
    }

    // 清理可能的脏数据
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

// === 内部逻辑处理函数 ===

/**
 * 处理握手请求（从网页建立连接）
 */
async function handleHandshake(request: any, tabId: number | null | undefined): Promise<HandshakeResponse> {
  const { port, token, force, workspaceId = 'global' } = request;

  if (!tabId) { return { success: false, error: "No Tab ID" }; }

  // 如果不强制建立连接，需要检查是否与其他标签页冲突
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
    // 发现同端口已有会话绑定在其他标签页
    if (conflictTabId) {
      try {
        const tab = await chrome.tabs.get(parseInt(conflictTabId));
        if (tab) {
          return { success: false, error: "BUSY", conflictTabId };
        }
      } catch {
        // 如果冲突的标签页已不存在，清除脏数据
        await SessionManager.removeSession(parseInt(conflictTabId));
      }
    }
  }

  // 绑定会话并初始化
  await bindSession(tabId, port, token, workspaceId);
  return { success: true };
}

/**
 * 为指定标签页绑定并激活会话
 */
async function bindSession(tabId: number, port: number, token: string, workspaceId: string) {
  await SessionManager.saveSession(tabId, { port, token, showLog: false, workspaceId });
  console.log(`[WebMCP] Tab ${tabId} bound to Port ${port} [Workspace: ${workspaceId}]`);

  // 更新扩展图标状态
  SessionManager.updateBadge(tabId, true);

  // [同步] 通知 Content Script 更新连接状态
  chrome.tabs.sendMessage(tabId, { type: "STATUS_UPDATE", connected: true, workspaceId }).catch(() => { });

  // 异步触发从网关拉取初始化数据（不阻塞当前执行）
  GatewayClient.fetchInitDataFromGateway(port, token);
}

/**
 * 路由并执行工具调用请求到 VS Code Gateway
 */
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
