// === 1. 初始化逻辑 ===
chrome.runtime.onInstalled.addListener(async () => {
  const files = { initialPrompt: "prompt.md", errorHint: "error_hint.md" };
  for (const [key, fileName] of Object.entries(files)) {
    try {
      const url = chrome.runtime.getURL(fileName);
      const response = await fetch(url);
      const text = await response.text();
      await chrome.storage.local.set({ [key]: text });
    } catch (err) { console.error(`Error loading ${fileName}`, err); }
  }
});

// === 2. 端口映射管理 ===
// Map<TabId, Port>
const tabPortMap = new Map();

// === 3. 消息监听 ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : null;

  // A. 处理握手请求 (来自 bridge_loader.js)
  if (request.type === 'HANDSHAKE') {
    if (tabId && request.port) {
      tabPortMap.set(tabId, request.port);
      console.log(`[Background] Handshake: Tab ${tabId} bound to Port ${request.port}`);
      
      // 持久化一份，防止 ServiceWorker 重启丢失
      chrome.storage.local.set({ [`port_${tabId}`]: request.port });
      
      sendResponse({ success: true });
    }
    return true;
  }

  // B. 处理工具调用 (来自 content.js)
  if (request.type === "EXECUTE_TOOL") {
    (async () => {
      try {
        // 1. 获取端口 (内存 -> Storage -> 默认)
        let port = tabPortMap.get(tabId);
        if (!port) {
          const key = `port_${tabId}`;
          const local = await chrome.storage.local.get([key]);
          port = local[key];
        }

        if (!port) {
             // 尝试从全局配置获取 (兼容旧模式)
             const sync = await chrome.storage.sync.get(['port']);
             port = sync.port || 34567;
        }

        const apiEndpoint = `http://127.0.0.1:${port}/v1/tools/call`;
        const apiBody = { name: request.payload.name, arguments: request.payload.arguments || {} };

        console.log(`[Background] calling ${apiEndpoint} for Tab ${tabId}`);

        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiBody),
        });

        if (response.ok) {
          const resJson = await response.json();
          const textContent = resJson.content
              ? resJson.content.map((c) => c.text).join("\n")
              : JSON.stringify(resJson);
          sendResponse({ success: true, data: textContent });
        } else {
          sendResponse({ success: false, error: `${response.status} - ${response.statusText}` });
        }
      } catch (err) {
        sendResponse({ success: false, error: `Connection Failed: ${err.message}` });
      }
    })();
    return true; // Keep channel open
  }
});

// === 4. 清理逻辑 ===
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabPortMap.has(tabId)) {
    tabPortMap.delete(tabId);
    chrome.storage.local.remove(`port_${tabId}`);
  }
});