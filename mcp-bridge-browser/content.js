(function () {
  "use strict";

  let CONFIG = {
    pollInterval: 1000,
    autoSend: true,
    autoPromptEnabled: false,
    // showFloatingLog: false, // 移除：由消息动态控制
  };

  // === 悬浮日志系统 (Floating Logger) ===
  const Logger = {
    el: null,
    contentEl: null,

    init() {
      if (this.el) return;
      this.el = document.createElement("div");
      Object.assign(this.el.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        width: "320px",
        height: "200px",
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        color: "#00ff00",
        fontFamily: "Consolas, Monaco, monospace",
        fontSize: "12px",
        zIndex: "99999",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        display: "none",
        flexDirection: "column",
        overflow: "hidden",
        border: "1px solid #333",
        backdropFilter: "blur(4px)",
      });

      const header = document.createElement("div");
      Object.assign(header.style, {
        padding: "6px 10px",
        backgroundColor: "#333",
        color: "#fff",
        cursor: "move",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontWeight: "bold",
        userSelect: "none",
      });
      header.innerText = "MCP Process Log";

      const clearBtn = document.createElement("span");
      clearBtn.innerText = "🗑️";
      clearBtn.style.cursor = "pointer";
      clearBtn.onclick = () => (this.contentEl.innerHTML = "");
      header.appendChild(clearBtn);

      this.contentEl = document.createElement("div");
      Object.assign(this.contentEl.style, {
        flex: "1",
        overflowY: "auto",
        padding: "8px",
        wordBreak: "break-all",
      });

      this.el.appendChild(header);
      this.el.appendChild(this.contentEl);
      document.body.appendChild(this.el);

      this.makeDraggable(header);
    },

    makeDraggable(headerEl) {
      let isDragging = false;
      let startX, startY, initialLeft, initialTop;
      headerEl.addEventListener("mousedown", (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = this.el.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
      });
      window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        this.el.style.left = `${initialLeft + dx}px`;
        this.el.style.top = `${initialTop + dy}px`;
        this.el.style.right = "auto";
      });
      window.addEventListener("mouseup", () => { isDragging = false; });
    },

    toggle(show) {
      if (!this.el && show) this.init();
      if (this.el) {
          this.el.style.display = show ? "flex" : "none";
      }
    },

    log(msg, type = "info") {
      if (!this.el || this.el.style.display === "none") return;

      const line = document.createElement("div");
      const time = new Date().toLocaleTimeString("en-US", { hour12: false });
      line.style.marginBottom = "4px";
      line.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
      line.style.paddingBottom = "2px";

      let icon = "🔹";
      let color = "#ddd";
      if (type === "success") { icon = "✅"; color = "#4caf50"; }
      if (type === "error") { icon = "❌"; color = "#f44336"; }
      if (type === "warn") { icon = "⚠️"; color = "#ff9800"; }
      if (type === "action") { icon = "⚡"; color = "#00bcd4"; }

      line.innerHTML = `<span style="color:#888; font-size:10px">[${time}]</span> ${icon} <span style="color:${color}">${msg}</span>`;
      this.contentEl.appendChild(line);
      this.contentEl.scrollTop = this.contentEl.scrollHeight;
    },
  };

  // === 监听 Background 发来的日志开关指令 ===
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'TOGGLE_LOG') {
          Logger.toggle(request.show);
          Logger.log("Logger Visible: " + request.show, "info");
      }
  });

  // === 初始化配置 ===
  chrome.storage.sync.get(
    ["autoSend", "autoPromptEnabled"],
    (items) => {
      CONFIG.autoSend = items.autoSend ?? true;
      CONFIG.autoPromptEnabled = items.autoPromptEnabled ?? false;
      console.log("[MCP] Config Loaded:", CONFIG);
    }
  );

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "sync") {
      if (changes.autoSend) CONFIG.autoSend = changes.autoSend.newValue;
      if (changes.autoPromptEnabled) CONFIG.autoPromptEnabled = changes.autoPromptEnabled.newValue;
    }
  });

  // === 主逻辑 ===
  const processedRequests = new Set();
  let toolCallCount = 0; // 工具调用计数器

  const SELECTORS = {
    deepseek: {
      messageBlocks: ".ds-message",
      codeBlocks: "pre",
      inputArea: "textarea.ds-scroll-area",
      sendButton: "button.send-button",
    },
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

  const currentPlatform = location.host.includes("deepseek") ? "deepseek" : location.host.includes("gemini") ? "gemini" : "chatgpt";
  const DOM = SELECTORS[currentPlatform];
  console.log(`[MCP Extension] Started on ${currentPlatform}`);

  setInterval(() => {
    const messages = document.querySelectorAll(DOM.messageBlocks);
    if (messages.length === 0) {
      const inputEl = document.querySelector(DOM.inputArea);
      if (inputEl && CONFIG.autoPromptEnabled && inputEl.textContent.trim() === "") {
        chrome.storage.local.get(["initialPrompt"], (items) => {
          if (items.initialPrompt) {
            inputEl.innerText = items.initialPrompt;
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));
            Logger.log("已自动填充初始 Prompt", "action");
          }
        });
      }
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const codeElements = lastMessage.querySelectorAll(DOM.codeBlocks);

    codeElements.forEach((codeEl) => {
      const textContent = codeEl.textContent.trim();
      if (!textContent.includes('"mcp_action": "call"')) return;

      try {
        const payload = JSON.parse(textContent);
        if (payload.mcp_action === "call" && payload.request_id) {
          if (processedRequests.has(payload.request_id)) {
            if (codeEl.dataset.mcpVisual !== "true") markVisualSuccess(codeEl);
            return;
          }

          processedRequests.add(payload.request_id);
          markVisualSuccess(codeEl);

          Logger.log(`捕获调用: ${payload.name}`, "info");
          Logger.log(`参数: ${JSON.stringify(payload.arguments).substring(0, 50)}...`, "info");

          chrome.runtime.sendMessage({ type: "EXECUTE_TOOL", payload: payload }, (response) => {
            if (response && response.success) {
              Logger.log(`执行成功: ${payload.name}`, "success");
              sendResponseToChat(payload.request_id, response.data);
            } else {
              Logger.log(`执行失败: ${response.error}`, "error");
              sendResponseToChat(payload.request_id, `❌ Error: ${response.error}`);
            }
          });
        }
      } catch (e) {}
    });
  }, CONFIG.pollInterval);

  function markVisualSuccess(element) {
    element.dataset.mcpVisual = "true";
    element.style.border = "2px solid #00E676";
    element.style.borderRadius = "4px";
  }

  function sendResponseToChat(requestId, outputContent) {
    toolCallCount++;
    const responseJson = {
      mcp_action: "result",
      request_id: requestId,
      status: "success",
      output: outputContent,
    };

    // === 定期复训机制 (每5次调用提醒一次) ===
    if (toolCallCount > 0 && toolCallCount % 5 === 0) {
        // 附带最小协议格式，防止 AI 遗忘字段结构
        responseJson.system_note = `[System] Reminder: Tool calls MUST use this JSON format: {"mcp_action":"call", "name": "tool_name", "arguments": {...}}. If unsure, call "list_tools" to refresh capabilities.`;
        Logger.log("已附加定期复训提示", "info");
    }
    const replyText = `\`\`\`json\n${JSON.stringify(responseJson, null, 2)}\n\`\`\``;
    const inputEl = document.querySelector(DOM.inputArea);
    if (!inputEl) { Logger.log("找不到输入框!", "error"); return; }

    const currentText = inputEl.innerText || inputEl.value || "";
    const separator = currentText.trim() ? "\n\n" : "";
    if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
      inputEl.value = currentText + separator + replyText;
    } else {
      inputEl.innerText = currentText + separator + replyText;
    }
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    Logger.log("结果已回填至输入框", "action");

    // === 智能发送重试逻辑 (后台增强版) ===
    if (CONFIG.autoSend) {
      let retryCount = 0;
      const maxRetries = 10; // 增加重试次数

      const trySend = () => {
        const btn = document.querySelector(DOM.sendButton);
        
        // 1. 检查输入框内容
        const currentVal = inputEl.value || inputEl.innerText || "";
        if (currentVal.trim().length === 0) {
             Logger.log("发送成功 (输入框已清空)", "success");
             return;
        }

        // 2. 唤醒机制 (针对后台 Tab)
        if (inputEl) {
            inputEl.focus();
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));
            inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        }

        // 3. 检查按钮状态
        if (!btn) {
           Logger.log("未找到发送按钮...", "warn");
        } else if (btn.disabled) {
           Logger.log("发送按钮仍被禁用 (UI未更新)...", "warn");
        } else {
           // 4. 暴力点击
           btn.focus();
           btn.click();
           Logger.log(`尝试自动发送 (${retryCount + 1}/${maxRetries})`, "action");
        }

        retryCount++;
        if (retryCount < maxRetries) {
           // 后台 Tab 的 setTimeout 可能会被降频，所以增加间隔
           setTimeout(trySend, 2000);
        } else {
           Logger.log("自动发送超时，请手动点击发送", "error");
        }
      };

      setTimeout(trySend, 1000);
    }
  }
})();