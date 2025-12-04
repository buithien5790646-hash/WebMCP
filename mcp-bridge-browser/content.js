(function () {
  "use strict";

  // === 配置管理 ===
  let CONFIG = {
    pollInterval: 1000,
    autoSend: true,
    autoPromptEnabled: false,
    showFloatingLog: false,
  };

  // === 悬浮日志系统 (Floating Logger) ===
  const Logger = {
    el: null,
    contentEl: null,

    init() {
      if (this.el) return;

      // 创建主容器
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

      // 创建标题栏 (拖拽区域)
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

      // 清空按钮
      const clearBtn = document.createElement("span");
      clearBtn.innerText = "🗑️";
      clearBtn.style.cursor = "pointer";
      clearBtn.onclick = () => (this.contentEl.innerHTML = "");
      header.appendChild(clearBtn);

      // 创建内容区域
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

      // 启用拖拽
      this.makeDraggable(header);
    },

    // 拖拽逻辑
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
        this.el.style.right = "auto"; // 清除 right 属性以允许自由移动
      });

      window.addEventListener("mouseup", () => {
        isDragging = false;
      });
    },

    toggle(show) {
      if (!this.el) this.init();
      this.el.style.display = show ? "flex" : "none";
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

      if (type === "success") {
        icon = "✅";
        color = "#4caf50";
      }
      if (type === "error") {
        icon = "❌";
        color = "#f44336";
      }
      if (type === "warn") {
        icon = "⚠️";
        color = "#ff9800";
      }
      if (type === "action") {
        icon = "⚡";
        color = "#00bcd4";
      }

      line.innerHTML = `<span style="color:#888; font-size:10px">[${time}]</span> ${icon} <span style="color:${color}">${msg}</span>`;

      this.contentEl.appendChild(line);
      this.contentEl.scrollTop = this.contentEl.scrollHeight;
    },
  };

  // === 初始化 & 配置加载 ===
  chrome.storage.sync.get(
    ["autoSend", "autoPromptEnabled", "showFloatingLog"],
    (items) => {
      CONFIG.autoSend = items.autoSend ?? true;
      CONFIG.autoPromptEnabled = items.autoPromptEnabled ?? false;
      CONFIG.showFloatingLog = items.showFloatingLog ?? false;

      Logger.init();
      Logger.toggle(CONFIG.showFloatingLog);
      console.log("[MCP] Config Loaded:", CONFIG);
    }
  );

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "sync") {
      if (changes.autoSend) CONFIG.autoSend = changes.autoSend.newValue;
      if (changes.autoPromptEnabled)
        CONFIG.autoPromptEnabled = changes.autoPromptEnabled.newValue;
      if (changes.showFloatingLog) {
        CONFIG.showFloatingLog = changes.showFloatingLog.newValue;
        Logger.toggle(CONFIG.showFloatingLog);
      }
    }
  });

  // === 主逻辑 ===
  const processedRequests = new Set();

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
      sendButton:
        'button[aria-label="发送"], button[aria-label="Send"], button[aria-label*="Send"]',
    },
  };

  const currentPlatform = location.host.includes("deepseek")
    ? "deepseek"
    : location.host.includes("gemini")
    ? "gemini"
    : "chatgpt";
  const DOM = SELECTORS[currentPlatform];

  console.log(`[MCP Extension] Started on ${currentPlatform}`);

  // 轮询检测
  setInterval(() => {
    // 1. 自动填充 Prompt 逻辑
    const messages = document.querySelectorAll(DOM.messageBlocks);
    if (messages.length === 0) {
      const inputEl = document.querySelector(DOM.inputArea);
      if (
        inputEl &&
        CONFIG.autoPromptEnabled &&
        inputEl.textContent.trim() === ""
      ) {
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

    // 2. 检测工具调用
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

          // === 捕获新请求 ===
          processedRequests.add(payload.request_id);
          markVisualSuccess(codeEl);

          Logger.log(`捕获调用: ${payload.name}`, "info");
          Logger.log(
            `参数: ${JSON.stringify(payload.arguments).substring(0, 50)}...`,
            "info"
          );

          // 发送给 Background
          chrome.runtime.sendMessage(
            { type: "EXECUTE_TOOL", payload: payload },
            (response) => {
              if (response && response.success) {
                Logger.log(`执行成功: ${payload.name}`, "success");
                sendResponseToChat(payload.request_id, response.data);
              } else {
                Logger.log(`执行失败: ${response.error}`, "error");
                sendResponseToChat(
                  payload.request_id,
                  `❌ Error: ${response.error}`
                );
              }
            }
          );
        } else {
          // 错误格式提示
          chrome.storage.local.get(["errorHint"], (items) => {
            const hint =
              items.errorHint || "❌ Error: Invalid MCP JSON format.";
            sendResponseToChat("error_format_hint_" + Date.now(), hint);
            Logger.log("格式错误，已发送提示", "warn");
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
      Logger.log("找不到输入框!", "error");
      return;
    }

    // 智能追加逻辑
    const currentText = inputEl.innerText || inputEl.value || "";
    const separator = currentText.trim() ? "\n\n" : "";

    if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
      inputEl.value = currentText + separator + replyText;
    } else {
      inputEl.innerText = currentText + separator + replyText;
    }
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    Logger.log("结果已回填至输入框", "action");

    // 智能发送重试逻辑
    if (CONFIG.autoSend) {
      let retryCount = 0;
      const maxRetries = 5;

      const trySend = () => {
        const btn = document.querySelector(DOM.sendButton);
        
        // 检查输入框内容（是否已清空）
        const currentVal = inputEl.value || inputEl.innerText || "";
        // 注意：某些平台清空后可能保留 \n 或 placeholder，长度判断宽松一点
        if (currentVal.trim().length === 0) {
             Logger.log("发送成功 (输入框已清空)", "success");
             return; // 成功退出
        }

        if (!btn || btn.disabled) {
           // 按钮不可用，等待下一轮
           Logger.log("发送按钮不可用/未找到，等待...", "warn");
        } else {
           btn.click();
           Logger.log(`尝试自动发送 (${retryCount + 1}/${maxRetries})`, "action");
        }

        retryCount++;
        if (retryCount < maxRetries) {
           setTimeout(trySend, 1500); // 间隔 1.5秒重试
        } else {
           Logger.log("自动发送失败，请手动点击发送", "error");
        }
      };

      // 首次延迟触发，给 UI 更新一点时间
      setTimeout(trySend, 1000);
    }
  }
})();