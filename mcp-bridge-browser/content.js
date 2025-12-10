(function () {
  "use strict";

  // 注意：DEFAULT_SELECTORS 现已由 config.js 提供，在此作用域中可以直接访问

  let CONFIG = {
    pollInterval: 1000,
    autoSend: true,
    autoPromptEnabled: false,
  };
  
  // === 国际化资源缓存 ===
  const i18n = {
    lang: navigator.language.startsWith('zh') ? 'zh' : 'en',
    prompt: null,
    train: null,
    error: null // New: Error Hint
  };

  // === 日志国际化字典 ===
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
    },
    config_updated: {
      en: "Selectors config updated",
      zh: "选择器配置已更新"
    }
  };

  function t(key) {
    const entry = LOG_MSGS[key];
    if (!entry) return key;
    return entry[i18n.lang] || entry.en;
  }

  const promptKey = i18n.lang === 'zh' ? 'prompt_zh' : 'prompt_en';
  const trainKey = i18n.lang === 'zh' ? 'train_zh' : 'train_en';
  const errorKey = i18n.lang === 'zh' ? 'error_zh' : 'error_en';
  
  chrome.storage.local.get([promptKey, trainKey, errorKey], (items) => {
      i18n.prompt = items[promptKey];
      i18n.train = items[trainKey];
      i18n.error = items[errorKey];
      console.log(`[MCP] Loaded i18n resources (${i18n.lang})`);
  });

  // === 悬浮日志系统 ===
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

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'TOGGLE_LOG') {
          Logger.toggle(request.show);
          Logger.log("Logger Visible: " + request.show, "info");
      }
  });

  // === 选择器管理 ===
  let activeSelectors = DEFAULT_SELECTORS; // 使用全局变量
  let DOM = null;
  const currentPlatform = location.host.includes("deepseek") ? "deepseek" : location.host.includes("gemini") ? "gemini" : "chatgpt";
  console.log(`[MCP Extension] Started on ${currentPlatform}`);

  function updateDOMConfig() {
      if (activeSelectors && activeSelectors[currentPlatform]) {
          DOM = activeSelectors[currentPlatform];
          console.log(`[MCP] DOM Selectors updated for ${currentPlatform}`);
      }
  }

  // === 初始化配置 ===
  chrome.storage.sync.get(
    ["autoSend", "autoPromptEnabled", "customSelectors"],
    (items) => {
      CONFIG.autoSend = items.autoSend ?? true;
      CONFIG.autoPromptEnabled = items.autoPromptEnabled ?? false;
      if (items.customSelectors) {
          activeSelectors = items.customSelectors;
      }
      updateDOMConfig();
      console.log("[MCP] Config Loaded:", CONFIG);
    }
  );

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "sync") {
      if (changes.autoSend) CONFIG.autoSend = changes.autoSend.newValue;
      if (changes.autoPromptEnabled) CONFIG.autoPromptEnabled = changes.autoPromptEnabled.newValue;
      if (changes.customSelectors) {
          activeSelectors = changes.customSelectors.newValue;
          updateDOMConfig();
          Logger.log(t("config_updated"), "action");
      }
    }
  });

  // === 主逻辑：批处理与队列管理 ===
  const processedRequests = new Set();
  const blockStates = new WeakMap(); 
  // 缓冲已完成的结果 (requestId -> outputString)
  const resultBuffer = new Map();
  // 追踪当前正在执行的请求 (requestId Set)
  const activeExecutions = new Set();

  const STABILIZATION_TIMEOUT = 3000;
  let toolCallCount = 0;
  let autoSendTimer = null;

  setInterval(() => {
    if (!DOM) return;

    const messages = document.querySelectorAll(DOM.messageBlocks);
    if (messages.length === 0) {
      const inputEl = document.querySelector(DOM.inputArea);
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

    // 扫描当前轮次的所有 Request ID (按 DOM 顺序)
    const currentTurnIds = [];

    codeElements.forEach((codeEl) => {
      const textContent = codeEl.textContent.trim();
      if (!textContent.includes('"mcp_action": "call"')) return;

      try {
        const payload = JSON.parse(textContent);
        // 解析成功，清除该块的错误状态记录
        if (blockStates.has(codeEl)) blockStates.delete(codeEl);
        if (codeEl.style.borderColor === "rgb(244, 67, 54)") codeEl.style.border = "none";

        if (payload.mcp_action === "call" && payload.request_id) {
          currentTurnIds.push(payload.request_id);

          if (!processedRequests.has(payload.request_id)) {
            processedRequests.add(payload.request_id);
            activeExecutions.add(payload.request_id);
            markVisualSuccess(codeEl);

            Logger.log(`${t("captured")}: ${payload.name}`, "info");
            Logger.log(`${t("args")}: ${JSON.stringify(payload.arguments).substring(0, 50)}...`, "info");

            // 执行工具
            executeTool(payload);
          } else {
             // 确保视觉状态正确 (用于重载场景)
             if (codeEl.dataset.mcpVisual !== "true") markVisualSuccess(codeEl);
          }
        }
      } catch (e) {
        // === 智能防抖错误检测 ===
        const now = Date.now();
        let state = blockStates.get(codeEl);

        if (!state || state.text !== textContent) {
            blockStates.set(codeEl, { text: textContent, time: now, errorNotified: false });
            if (codeEl.style.borderColor === "rgb(244, 67, 54)") {
                codeEl.style.border = "none";
            }
        } else {
            if (now - state.time > STABILIZATION_TIMEOUT && !state.errorNotified) {
                Logger.log("JSON Parse Error (Stable): " + e.message, "error");
                codeEl.style.border = "2px solid #F44336";
                chrome.runtime.sendMessage({ type: "SHOW_NOTIFICATION", title: "WebMCP Error", message: "Invalid JSON format (Stuck)." });
                state.errorNotified = true;
                blockStates.set(codeEl, state);
            }
        }
      }
    });

    // === 批处理检查 ===
    // 条件：当前有工具调用，且所有调用都不在活跃状态(都已返回)，且所有结果都在缓冲区中
    if (currentTurnIds.length > 0) {
        const allFinished = currentTurnIds.every(id => !activeExecutions.has(id) && resultBuffer.has(id));
        
        if (allFinished) {
             // 按 DOM 顺序收集结果
             const orderedResults = [];
             let hasUnflushedContent = false;

             currentTurnIds.forEach(id => {
                 const res = resultBuffer.get(id);
                 if (res) {
                    // 只有非空结果才算有效内容 (排除虚拟工具的占位符)
                    orderedResults.push(res);
                    hasUnflushedContent = true;
                 }
             });

             if (hasUnflushedContent) {
                 Logger.log(`Batch finished: ${orderedResults.length} tools. Writing...`, "success");
                 
                 const finalOutput = orderedResults.join("\n\n");
                 writeToInputBox(finalOutput);
                 
                 // 清空已消费的缓冲区，防止重复写入
                 currentTurnIds.forEach(id => resultBuffer.delete(id));
                 
                 triggerAutoSend();
             } else {
                 // 可能是纯虚拟工具调用，消费掉 Buffer 即可，无需写入
                 const anyVirtual = currentTurnIds.some(id => resultBuffer.has(id));
                 if (anyVirtual) {
                      currentTurnIds.forEach(id => resultBuffer.delete(id));
                 }
             }
        }
    }
  }, CONFIG.pollInterval);

  // === 执行工具 ===
  function executeTool(payload) {
      if (payload.name === "task_completion_notification") {
          const msg = payload.arguments?.message || "Task Completed";
          Logger.log(`🔔 Notification: ${msg}`, "action");
          chrome.runtime.sendMessage({ type: "SHOW_NOTIFICATION", title: "WebMCP Task Finished", message: msg });
          
          // 标记完成，存入空结果占位
          activeExecutions.delete(payload.request_id);
          resultBuffer.set(payload.request_id, "");
          return;
      }

      chrome.runtime.sendMessage({ type: "EXECUTE_TOOL", payload: payload }, (response) => {
          activeExecutions.delete(payload.request_id);

          let outputContent = "";
          if (response && response.success) {
              Logger.log(`${t("exec_success")}: ${payload.name}`, "success");
              let finalData = response.data;
              
              // 注入虚拟工具定义
              if (payload.name === "list_tools") {
                  try {
                      const tools = JSON.parse(finalData);
                      tools.push({
                          name: "task_completion_notification",
                          description: "Notify the user that a long-running task or a series of complex operations is complete. Use this when you need the user's attention to review your work or provide new instructions. Calling this will trigger a system notification on the user's device.",
                          inputSchema: {
                              type: "object",
                              properties: {
                                  message: {
                                      type: "string",
                                      description: "Short summary of what was completed (e.g. 'Analysis of 50 files finished')."
                                  }
                              },
                              required: ["message"]
                          }
                      });
                      finalData = JSON.stringify(tools, null, 2);
                  } catch (e) {
                      console.error("Failed to inject virtual tool", e);
                  }
              }
              outputContent = finalData;
          } else {
              Logger.log(`${t("exec_fail")}: ${response.error}`, "error");
              outputContent = `❌ Error: ${response.error}`;
          }

          const responseJson = {
              mcp_action: "result",
              request_id: payload.request_id,
              status: "success",
              output: outputContent,
          };

          // 训练提示注入逻辑
          toolCallCount++;
          if (toolCallCount > 0 && toolCallCount % 5 === 0) {
             if (i18n.train) {
                  responseJson.system_note = i18n.train;
                  Logger.log(t("training_hint") + " (Train/i18n)", "info");
             } else {
                  responseJson.system_note = `[System] Reminder: Tool calls MUST use this JSON format: {"mcp_action":"call", "name": "tool_name", "arguments": {...}}.`;
             }
          }

          const jsonString = `\`\`\`json\n${JSON.stringify(responseJson, null, 2)}\n\`\`\``;
          resultBuffer.set(payload.request_id, jsonString);
      });
  }

  function markVisualSuccess(element) {
    element.dataset.mcpVisual = "true";
    element.style.border = "2px solid #00E676";
    element.style.borderRadius = "4px";
  }

  function writeToInputBox(textToAdd) {
    if (!textToAdd.trim()) return;

    const inputEl = document.querySelector(DOM.inputArea);
    if (!inputEl) { Logger.log(t("input_not_found"), "error"); return; }

    let currentText = inputEl.innerText || inputEl.value || "";
    currentText = currentText.replace(/\r\n/g, "\n").replace(/\n+/g, "\n").trim();
    const separator = currentText ? "\n\n" : "";
    const finalText = currentText + separator + textToAdd;

    inputEl.focus();
    let success = false;
    try {
        document.execCommand('selectAll', false, null);
        success = document.execCommand('insertText', false, finalText);
    } catch (e) {}

    if (!success) {
        if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
            inputEl.value = finalText;
        } else {
            inputEl.innerText = finalText;
        }
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    }
    Logger.log(t("result_written"), "action");
  }

  function triggerAutoSend() {
    if (!CONFIG.autoSend) return;

    if (autoSendTimer) {
        clearTimeout(autoSendTimer);
        autoSendTimer = null;
    }

    let retryCount = 0;
    const maxRetries = 5;
    const trySend = () => {
      const btn = document.querySelector(DOM.sendButton);
      const inputEl = document.querySelector(DOM.inputArea);
      const currentVal = inputEl ? (inputEl.value || inputEl.innerText || "") : "";
      
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
      if (retryCount < maxRetries) {
          autoSendTimer = setTimeout(trySend, 2000);
      } else {
          Logger.log(t("auto_send_timeout"), "error");
          chrome.runtime.sendMessage({ type: "SHOW_NOTIFICATION", title: "Auto-Send Failed", message: "Could not click send button." });
      }
    };
    autoSendTimer = setTimeout(trySend, 1000);
  }
})();