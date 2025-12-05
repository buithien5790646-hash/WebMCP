document.addEventListener("DOMContentLoaded", async () => {
  const connectedView = document.getElementById('connectedView');
  const disconnectedView = document.getElementById('disconnectedView');
  const statusDot = document.getElementById('statusDot');
  const portDisplay = document.getElementById('portDisplay');
  const copyPromptBtn = document.getElementById('copyPromptBtn');
  const autoSendInput = document.getElementById('autoSend');
  const showLogInput = document.getElementById('showLog');

  // 获取当前 Tab ID
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTabId = tabs[0] ? tabs[0].id : null;

  if (!currentTabId) return;

  // 向 Background 查询状态
  chrome.runtime.sendMessage({ type: 'GET_STATUS', tabId: currentTabId }, (response) => {
    if (response && response.connected) {
      connectedView.classList.remove('hidden');
      disconnectedView.classList.add('hidden');
      statusDot.classList.add('online');
      portDisplay.innerText = response.port;

      // 回填 Log 开关状态 (从 Background Session 获取)
      showLogInput.checked = response.showLog;
    } else {
      connectedView.classList.add('hidden');
      disconnectedView.classList.remove('hidden');
      statusDot.classList.remove('online');
    }
  });

  copyPromptBtn.addEventListener("click", () => {
    chrome.storage.local.get(["initialPrompt"], (items) => {
      if (items.initialPrompt) {
        navigator.clipboard.writeText(items.initialPrompt).then(() => {
          const originalText = copyPromptBtn.innerText;
          copyPromptBtn.innerText = "Copied!";
          copyPromptBtn.style.backgroundColor = "#0d8a6a";
          setTimeout(() => {
            copyPromptBtn.innerText = originalText;
            copyPromptBtn.style.backgroundColor = "";
          }, 1500);
        });
      } else {
        copyPromptBtn.innerText = "Prompt Not Loaded";
      }
    });
  });

  // Auto Send (Global Config)
  chrome.storage.sync.get(['autoSend'], (items) => {
      autoSendInput.checked = items.autoSend !== undefined ? items.autoSend : true;
  });
  autoSendInput.addEventListener('change', () => {
      chrome.storage.sync.set({ autoSend: autoSendInput.checked });
  });

  // Log Toggle (Tab Session)
  showLogInput.addEventListener('change', () => {
      chrome.runtime.sendMessage({
          type: 'SET_LOG_VISIBLE',
          tabId: currentTabId,
          show: showLogInput.checked
      });
  });
});