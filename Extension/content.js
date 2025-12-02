(function () {
  "use strict";

  // 默认配置，稍后会从 Storage 覆盖
  let CONFIG = {
    pollInterval: 1000,
    autoSend: true,
  };

  // 1. 初始化时读取配置
  chrome.storage.sync.get(['autoSend'], (result) => {
    if (result.autoSend !== undefined) {
      CONFIG.autoSend = result.autoSend;
    }
    console.log(`[MCP Bridge] 初始配置加载: AutoSend=${CONFIG.autoSend}`);
  });

  // 2. 监听配置实时变化 (Popup 修改后立即生效)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.autoSend) {
      CONFIG.autoSend = changes.autoSend.newValue;
      console.log(`[MCP Bridge] 配置更新: AutoSend -> ${CONFIG.autoSend}`);
    }
  });

  const processedRequests = new Set();

  const SELECTORS = {
    chatgpt: {
      messageBlocks: 'div[data-message-author-role="assistant"]',
      codeBlocks: "pre code",
      inputArea: "#prompt-textarea",
      sendButton: 'button[data-testid="send-button"]',
    },
    gemini: {
      messageBlocks: ".markdown",
      codeBlocks: "pre code",
      inputArea: 'div[contenteditable="true"]',
      sendButton: 'button[aria-label="发送"], button[aria-label="Send"], button[aria-label*="Send"]',
    },
  };

  const currentPlatform = location.host.includes("gemini") ? "gemini" : "chatgpt";
  const DOM = SELECTORS[currentPlatform];

  console.log(`[MCP Extension] 🚀 v1.2 已启动! 平台: ${currentPlatform}`);

  // --- 主循环 ---
  setInterval(() => {
    const messages = document.querySelectorAll(DOM.messageBlocks);
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    const codeElements = lastMessage.querySelectorAll(DOM.codeBlocks);

    codeElements.forEach((codeEl) => {
      const textContent = codeEl.textContent.trim();
      if (!textContent.includes('"mcp_action": "call"')) return;

      try {
        const payload = JSON.parse(textContent);

        if (payload.mcp_action === "call" && payload.request_id) {
          if (processedRequests.has(payload.request_id)) {
            if (codeEl.dataset.mcpVisual !== "true") {
              markVisualSuccess(codeEl);
            }
            return;
          }

          console.log(`[MCP Bridge] ⚡ 捕获: ${payload.name}`);
          processedRequests.add(payload.request_id);
          markVisualSuccess(codeEl);

          // 发送消息给 background.js 处理网络请求
          chrome.runtime.sendMessage(
            { type: "EXECUTE_TOOL", payload: payload },
            (response) => {
              if (response && response.success) {
                sendResponseToChat(payload.request_id, response.data);
              } else {
                sendResponseToChat(payload.request_id, `❌ Error: ${response.error}`);
              }
            }
          );
        }
      } catch (e) {
        // ignore JSON parse error
      }
    });
  }, CONFIG.pollInterval);

  // --- 辅助函数 ---
  function markVisualSuccess(element) {
    element.dataset.mcpVisual = "true";
    element.style.border = "2px solid #00E676";
    element.style.borderRadius = "4px";
    element.style.boxShadow = "0 0 10px rgba(0, 230, 118, 0.3)";
  }

  function sendResponseToChat(requestId, outputContent) {
    const responseJson = {
      mcp_action: "result",
      request_id: requestId,
      status: "success",
      output: outputContent,
    };

    const replyText = `\`\`\`json\n${JSON.stringify(responseJson, null, 2)}\n\`\`\``;

    const inputEl = document.querySelector(DOM.inputArea);
    if (!inputEl) {
      console.warn("找不到输入框");
      return;
    }

    inputEl.innerHTML = "";
    inputEl.innerText = replyText;
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));

    // 检查最新的配置是否允许自动发送
    if (CONFIG.autoSend) {
      setTimeout(() => {
        const btn = document.querySelector(DOM.sendButton);
        if (btn) btn.click();
      }, 800);
    }
  }
})();