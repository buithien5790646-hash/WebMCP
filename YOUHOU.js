// ==UserScript==
// @name         MCP2API Bridge (Universal) - v1.1 Optimized
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  将网页版 AI (ChatGPT/Gemini) 连接到本地 MCP2API 网关 (修复重复调用问题)
// @author       You & Gemini
// @match        https://chatgpt.com/*
// @match        https://gemini.google.com/*
// @connect      localhost
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
  "use strict";

  // ================= 配置区 =================
  const CONFIG = {
    apiEndpoint: "http://localhost:3000/v1/tools/call",
    pollInterval: 1000,
    autoSend: true,
  };

  // ================= 全局状态 (内存去重) =================
  // 使用 Set 存储已处理的 request_id，即使 DOM 被重建，这里也不会丢
  const processedRequests = new Set();

  // ================= 平台适配器 =================
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
      sendButton:
        'button[aria-label="发送"], button[aria-label="Send"], button[aria-label*="Send"]',
    },
  };

  const currentPlatform = location.host.includes("gemini")
    ? "gemini"
    : "chatgpt";
  const DOM = SELECTORS[currentPlatform];

  console.log(`[MCP Bridge] 🚀 v1.1 已启动! 正在监听 ${currentPlatform}...`);

  // ================= 主逻辑循环 =================

  setInterval(() => {
    const messages = document.querySelectorAll(DOM.messageBlocks);
    if (messages.length === 0) return;

    // 只检查最后一条消息
    const lastMessage = messages[messages.length - 1];
    const codeElements = lastMessage.querySelectorAll(DOM.codeBlocks);

    codeElements.forEach((codeEl) => {
      const textContent = codeEl.textContent.trim();

      // 1. 初步特征检测
      if (!textContent.includes('"mcp_action": "call"')) return;

      try {
        const payload = JSON.parse(textContent);

        // 2. 核心去重逻辑：检查 request_id 是否在内存中存在
        if (payload.mcp_action === "call" && payload.request_id) {
          if (processedRequests.has(payload.request_id)) {
            // 虽然处理过了，但为了视觉反馈，如果 DOM 重建了，我们还是把绿框补上
            if (codeEl.dataset.mcpVisual !== "true") {
              markVisualSuccess(codeEl);
            }
            return; // ⛔️ 坚决不再执行网络请求
          }

          // 3. 首次捕获
          console.log(
            `[MCP Bridge] ⚡ 捕获新指令: ${payload.name} (ID: ${payload.request_id})`
          );

          // 立即加入内存黑名单，防止并发或下一次轮询重复触发
          processedRequests.add(payload.request_id);

          // 视觉标记
          markVisualSuccess(codeEl);

          // 执行远程调用
          executeTool(payload);
        }
      } catch (e) {
        // JSON 解析中或格式错误，忽略
      }
    });
  }, CONFIG.pollInterval);

  // ================= 辅助函数 =================

  function markVisualSuccess(element) {
    element.dataset.mcpVisual = "true"; // 仅用于标记“已加特效”
    element.style.border = "2px solid #00E676";
    element.style.borderRadius = "4px";
    element.style.boxShadow = "0 0 10px rgba(0, 230, 118, 0.3)";
  }

  function executeTool(payload) {
    const apiBody = {
      name: payload.name,
      arguments: payload.arguments || {},
    };

    GM_xmlhttpRequest({
      method: "POST",
      url: CONFIG.apiEndpoint,
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify(apiBody),
      onload: function (response) {
        console.log(`[MCP Bridge] ✅ API 响应: ${response.status}`);

        let resultOutput;
        if (response.status === 200) {
          try {
            const resJson = JSON.parse(response.responseText);
            const textContent = resJson.content
              ? resJson.content.map((c) => c.text).join("\n")
              : JSON.stringify(resJson);
            resultOutput = textContent;
          } catch (e) {
            resultOutput = response.responseText;
          }
        } else {
          resultOutput = `❌ API Error: ${response.status} - ${response.statusText}`;
        }

        sendResponseToChat(payload.request_id, resultOutput);
      },
      onerror: function (err) {
        console.error(err);
        sendResponseToChat(
          payload.request_id,
          `❌ Connection Error: 无法连接本地服务`
        );
      },
    });
  }

  function sendResponseToChat(requestId, outputContent) {
    // 防止输出太长导致浏览器卡顿，限制一下长度 (可选)
    const MAX_LENGTH = 10000;
    if (outputContent.length > MAX_LENGTH) {
      outputContent =
        outputContent.substring(0, MAX_LENGTH) + "\n... (输出过长已截断)";
    }

    const responseJson = {
      mcp_action: "result",
      request_id: requestId,
      status: "success",
      output: outputContent,
    };

    const replyText = `\`\`\`json\n${JSON.stringify(
      responseJson,
      null,
      2
    )}\n\`\`\``;

    const inputEl = document.querySelector(DOM.inputArea);
    if (!inputEl) {
      console.warn("[MCP Bridge] 找不到输入框，无法回填");
      return;
    }

    // 模拟输入
    if (currentPlatform === "gemini") {
      inputEl.innerText = replyText;
    } else {
      inputEl.value = replyText;
    }
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));

    if (CONFIG.autoSend) {
      setTimeout(() => {
        const btn = document.querySelector(DOM.sendButton);
        if (btn) {
          btn.click();
        }
      }, 800);
    }
  }
})();
