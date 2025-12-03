// === 1. 初始化逻辑：加载配置文件 ===
chrome.runtime.onInstalled.addListener(async () => {
  const files = {
    initialPrompt: "prompt.md",
    errorHint: "error_hint.md"
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

// === 2. 消息监听：处理工具执行请求 ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "EXECUTE_TOOL") {
    
    // 动态获取端口配置
    chrome.storage.sync.get(['port'], (items) => {
      const port = items.port || 3000;
      const apiEndpoint = `http://localhost:${port}/v1/tools/call`;
      
      const apiBody = {
        name: request.payload.name,
        arguments: request.payload.arguments || {},
      };

      console.log(`[Background] Connecting to MCP Gateway on port ${port}...`);

      fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiBody),
      })
        .then(async (response) => {
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
            sendResponse({ success: false, error: `${response.status} - ${response.statusText}` });
          }
        })
        .catch((err) => {
          sendResponse({ success: false, error: `Connection Failed to port ${port} (Is Gateway running?)` });
        });
    });

    return true; // 必须返回 true 以便异步发送响应
  }
});