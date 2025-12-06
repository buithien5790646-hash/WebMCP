(function () {
  "use strict";

  let CONFIG = {
    pollInterval: 1000,
    autoSend: true,
    autoPromptEnabled: false,
  };
  
  // === 国际化资源缓存 ===
  const i18n = {
    lang: navigator.language.startsWith('zh') ? 'zh' : 'en',
    prompt: null,
    train: null
  };

  // === 日志国际化字典 (Log i18n Dictionary) ===
  // 策略：英文环境纯英文，中文环境保留中文描述
  const LOG_MSGS = {
    auto_filled: {
      en: "Auto-filled initial Prompt",
      zh: "已自动填充初始 Prompt"
    },
    captured: {
      en: "Captured Call",
      zh: "捕获调用"
    },
    args: {
      en: "Args",
      zh: "参数"
    },
    exec_success: {
      en: "Execution Success",
      zh: "执行成功"
    },
    exec_fail: {
      en: "Execution Failed",
      zh: "执行失败"
    },
    training_hint: {
      en: "Added periodic training note",
      zh: "已附加定期复训提示"
    },
    input_not_found: {
      en: "Input box not found!",
      zh: "找不到输入框!"
    },
    result_written: {
      en: "Result written back to input",
      zh: "结果已回填至输入框"
    },
    send_success_cleared: {
      en: "Send success (Input cleared)",
      zh: "发送成功 (输入框已清空)"
    },
    send_btn_missing: {
      en: "Send button not found...",
      zh: "未找到发送按钮..."
    },
    send_btn_disabled: {
      en: "Send button disabled (UI not updated)...",
      zh: "发送按钮仍被禁用 (UI未更新)..."
    },
    auto_send_attempt: {
      en: "Attempting auto-send",
      zh: "尝试自动发送"
    },
    auto_send_timeout: {
      en: "Auto-send timed out, please click manually",
      zh: "自动发送超时，请手动点击发送"
    }
  };

  // 简单的翻译辅助函数
  function t(key) {
    const entry = LOG_MSGS[key];
    if (!entry) return key;
    return entry[i18n.lang] || entry.en;
  }

  // 初始化时预加载资源
  const promptKey = i18n.lang === 'zh' ? 'prompt_zh' : 'prompt_en';
  const trainKey = i18n.lang === 'zh' ? 'train_zh' : 'train_en';
  
  chrome.storage.local.get([promptKey, trainKey], (items) => {
      i18n.prompt = items[promptKey];
      i18n.train = items[trainKey];
      console.log(`[MCP] Loaded i18n resources (${i18n.lang})`);
  });

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
      header.innerText = "WebMCP Bridge Process Log";

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
      // 自动填充 Prompt (支持国际化)
      if (inputEl && CONFIG.autoPromptEnabled && inputEl.textContent.trim() === "") {
          if (i18n.prompt) {
            inputEl.innerText = i18n.prompt;
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));
            Logger.log(t("auto_filled"), "action");
          }
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

          Logger.log(`${t("captured")}: ${payload.name}`, "info");
          // 简略显示参数
          Logger.log(`${t("args")}: ${JSON.stringify(payload.arguments).substring(0, 50)}...`, "info");

          chrome.runtime.sendMessage({ type: "EXECUTE_TOOL", payload: payload }, (response) => {
            if (response && response.success) {
              Logger.log(`${t("exec_success")}: ${payload.name}`, "success");
              sendResponseToChat(payload.request_id, response.data);
            } else {
              Logger.log(`${t("exec_fail")}: ${response.error}`, "error");
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
        if (i18n.train) {
             responseJson.system_note = i18n.train;
             Logger.log(t("training_hint") + " (Train/i18n)", "info");
        } else {
             responseJson.system_note = `[System] Reminder: Tool calls MUST use this JSON format: {"mcp_action":"call", "name": "tool_name", "arguments": {...}}.`;
        }
    }
    const replyText = `\`\`\`json\n${JSON.stringify(responseJson, null, 2)}\n\`\`\``;
    const inputEl = document.querySelector(DOM.inputArea);
    if (!inputEl) { Logger.log(t("input_not_found"), "error"); return; }

    const currentText = inputEl.innerText || inputEl.value || "";
    const separator = currentText.trim() ? "\n\n" : "";
    if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
      inputEl.value = currentText + separator + replyText;
    } else {
      inputEl.innerText = currentText + separator + replyText;
    }
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    Logger.log(t("result_written"), "action");

    // === 智能发送重试逻辑 ===
    if (CONFIG.autoSend) {
      let retryCount = 0;
      const maxRetries = 10;
      const trySend = () => {
        const btn = document.querySelector(DOM.sendButton);
        const currentVal = inputEl.value || inputEl.innerText || "";
        if (currentVal.trim().length === 0) { Logger.log(t("send_success_cleared"), "success"); return; }

        if (inputEl) {
            inputEl.focus();
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));
            inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        }

        if (btn && !btn.disabled) {
           btn.focus();
           btn.click();
           Logger.log(`${t("auto_send_attempt")} (${retryCount + 1})`, "action");
        } else if (!btn) {
           Logger.log(t("send_btn_missing"), "warn");
        } else {
           Logger.log(t("send_btn_disabled"), "warn");
        }

        retryCount++;
        if (retryCount < maxRetries) setTimeout(trySend, 2000);
        else Logger.log(t("auto_send_timeout"), "error");
      };
      setTimeout(trySend, 1000);
    }
  }
})();