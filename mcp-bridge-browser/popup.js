document.addEventListener("DOMContentLoaded", () => {
  // 1. 显示插件 ID
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

  // 2. 复制初始提示词
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

  // 3. 配置管理
  const portInput = document.getElementById("port");
  const autoSendInput = document.getElementById("autoSend");
  const autoPromptInput = document.getElementById("autoPrompt");
  const showFloatingLogInput = document.getElementById("showFloatingLog");
  const statusDiv = document.getElementById("status");

  // 加载配置
  chrome.storage.sync.get(
    ["port", "autoSend", "autoPromptEnabled", "showFloatingLog"],
    (items) => {
      portInput.value = items.port || 34567;
      autoSendInput.checked =
        items.autoSend !== undefined ? items.autoSend : true;
      autoPromptInput.checked =
        items.autoPromptEnabled !== undefined ? items.autoPromptEnabled : false;
      showFloatingLogInput.checked =
        items.showFloatingLog !== undefined ? items.showFloatingLog : false;
    }
  );

  // 监听保存
  const saveOptions = () => {
    const port = portInput.value;
    const autoSend = autoSendInput.checked;
    const autoPromptEnabled = autoPromptInput.checked;
    const showFloatingLog = showFloatingLogInput.checked;

    chrome.storage.sync.set(
      { port, autoSend, autoPromptEnabled, showFloatingLog },
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
