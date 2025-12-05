document.addEventListener("DOMContentLoaded", () => {
  // === 1. 显示插件 ID ===
  const extIdInput = document.getElementById("extensionId");
  const copyBtn = document.getElementById("copyBtn");
  if (extIdInput) {
    extIdInput.value = chrome.runtime.id;
    copyBtn.addEventListener("click", () => {
      extIdInput.select();
      document.execCommand("copy");
      const originalText = copyBtn.innerText;
      copyBtn.innerText = "Copied!";
      setTimeout(() => (copyBtn.innerText = originalText), 1500);
    });
  }

  // === 2. 复制初始提示词 ===
  const copyPromptBtn = document.getElementById("copyPromptBtn");
  if (copyPromptBtn) {
    copyPromptBtn.addEventListener("click", () => {
      chrome.storage.local.get(["initialPrompt"], (items) => {
        if (items.initialPrompt) {
          navigator.clipboard.writeText(items.initialPrompt).then(() => {
            const originalText = copyPromptBtn.innerText;
            copyPromptBtn.innerText = "Copied to Clipboard!";
            copyPromptBtn.style.backgroundColor = "#0d8a6a";
            setTimeout(() => {
              copyPromptBtn.innerText = originalText;
              copyPromptBtn.style.backgroundColor = "#10a37f";
            }, 1500);
          });
        } else {
          copyPromptBtn.innerText = "Not Loaded Yet (Reload Extension)";
          setTimeout(
            () => (copyPromptBtn.innerText = "Copy System Prompt"),
            2000
          );
        }
      });
    });
  }

  // === 3. 配置管理 (Tab 级隔离) ===
  const portInput = document.getElementById("port");
  const autoSendInput = document.getElementById("autoSend");
  const autoPromptInput = document.getElementById("autoPrompt");
  const showFloatingLogInput = document.getElementById("showFloatingLog");
  const statusDiv = document.getElementById("status");

  // 辅助函数：获取当前 Tab ID
  const getCurrentTabId = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] ? tabs[0].id : null;
  };

  // 加载配置
  (async () => {
    const tabId = await getCurrentTabId();
    const tabPortKey = tabId ? `port_${tabId}` : null;

    // 1. 读取全局配置
    chrome.storage.sync.get(
      ["port", "autoSend", "autoPromptEnabled", "showFloatingLog"],
      async (globalItems) => {
        // 设置默认值
        let displayPort = globalItems.port || 34567;
        
        // 2. 尝试读取 Tab 专属端口配置进行覆盖
        if (tabPortKey) {
          const localItems = await chrome.storage.local.get([tabPortKey]);
          if (localItems[tabPortKey]) {
            displayPort = localItems[tabPortKey];
          }
        }

        // 应用到 UI
        portInput.value = displayPort;
        autoSendInput.checked = globalItems.autoSend !== undefined ? globalItems.autoSend : true;
        autoPromptInput.checked = globalItems.autoPromptEnabled !== undefined ? globalItems.autoPromptEnabled : false;
        showFloatingLogInput.checked = globalItems.showFloatingLog !== undefined ? globalItems.showFloatingLog : false;
      }
    );
  })();

  // 监听保存
  const saveOptions = async () => {
    const port = portInput.value;
    const autoSend = autoSendInput.checked;
    const autoPromptEnabled = autoPromptInput.checked;
    const showFloatingLog = showFloatingLogInput.checked;

    // 1. 端口配置保存到 Local (关联 Tab ID)
    const tabId = await getCurrentTabId();
    if (tabId) {
        const tabPortKey = `port_${tabId}`;
        await chrome.storage.local.set({ [tabPortKey]: port });
    }

    // 2. 其他配置保存到 Sync (全局)
    // 注意：这里不再保存 port 到 sync，避免污染全局默认值
    chrome.storage.sync.set(
      { autoSend, autoPromptEnabled, showFloatingLog },
      () => {
        statusDiv.style.opacity = "1";
        setTimeout(() => {
          statusDiv.style.opacity = "0";
        }, 1500);
      }
    );
  };

  portInput.addEventListener("input", saveOptions);
  autoSendInput.addEventListener("change", saveOptions);
  autoPromptInput.addEventListener("change", saveOptions);
  showFloatingLogInput.addEventListener("change", saveOptions);
});