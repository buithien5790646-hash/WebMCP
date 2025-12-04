// === 1. 初始化逻辑：加载配置文件 ===
chrome.runtime.onInstalled.addListener(async () => {
  const files = {
    initialPrompt: "prompt.md",
    errorHint: "error_hint.md",
  };

  for (const [key, fileName] of Object.entries(files)) {
    try {
      const url = chrome.runtime.getURL(fileName);
      const response = await fetch(url);
      const text = await response.text();
      await chrome.storage.local.set({ [key]: text });
      console.log(`[Background] ✅ 已加载 ${fileName} -> ${key}`);
    } catch (err) {
      console.error(`[Background] ❌ 加载 ${fileName} 失败:`, err);
    }
  }
});

// === 辅助函数：获取当前 Tab 的端口配置 ===
async function getPortForTab(tabId) {
  // 1. 尝试获取 Tab 专属端口
  const tabKey = `port_${tabId}`;
  const localItems = await chrome.storage.local.get([tabKey]);
  if (localItems[tabKey]) {
    return localItems[tabKey];
  }

  // 2. 回退到全局配置
  const syncItems = await chrome.storage.sync.get(["port"]);
  return syncItems.port || 34567;
}

// === 2. 消息监听：处理工具执行请求 ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "EXECUTE_TOOL") {
    // 异步处理流程
    (async () => {
      try {
        const tabId = sender.tab ? sender.tab.id : null;
        const port = await getPortForTab(tabId);

        const apiEndpoint = `http://localhost:${port}/v1/tools/call`;

        const apiBody = {
          name: request.payload.name,
          arguments: request.payload.arguments || {},
        };

        console.log(
          `[Background] Tab[${tabId}] Connecting to MCP Gateway on port ${port}...`
        );

        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiBody),
        });

        if (response.ok) {
          try {
            const resJson = await response.json();
            // 格式化输出
            const textContent = resJson.content
              ? resJson.content.map((c) => c.text).join("\n")
              : JSON.stringify(resJson);
            sendResponse({ success: true, data: textContent });
          } catch (e) {
            const text = await response.text();
            sendResponse({ success: true, data: text });
          }
        } else {
          sendResponse({
            success: false,
            error: `${response.status} - ${response.statusText}`,
          });
        }
      } catch (err) {
        sendResponse({
          success: false,
          error: `Connection Failed (Is Gateway running?). Error: ${err.message}`,
        });
      }
    })();

    return true; // 保持消息通道开启
  }
});

// === 3. 清理逻辑：Tab 关闭时清除专属配置 ===
chrome.tabs.onRemoved.addListener((tabId) => {
  const tabKey = `port_${tabId}`;
  chrome.storage.local.remove(tabKey, () => {
    // 如果需要调试，可以打开下面的注释
    // console.log(`[Background] Cleared config for closed tab: ${tabId}`);
  });
});
