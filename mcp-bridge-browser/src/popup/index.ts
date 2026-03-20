import { Session, MessageRequest, HandshakeResponse, StatusResponse, ExecuteToolResponse } from '../types';

document.addEventListener("DOMContentLoaded", async () => {
  const connectedView = document.getElementById("connectedView") as HTMLElement;
  const disconnectedView = document.getElementById("disconnectedView") as HTMLElement;
  const statusDot = document.getElementById("statusDot") as HTMLElement;
  const portDisplay = document.getElementById("portDisplay") as HTMLElement;
  const copyPromptBtn = document.getElementById("copyPromptBtn") as HTMLButtonElement;
  const copyInitBtn = document.getElementById("copyInitBtn") as HTMLButtonElement;
  const openOptionsBtn = document.getElementById("openOptionsBtn") as HTMLButtonElement;
  const autoSendInput = document.getElementById("autoSend") as HTMLInputElement;
  const showLogInput = document.getElementById("showLog") as HTMLInputElement;
  const availableView = document.getElementById("availableView") as HTMLElement;
  const gatewayList = document.getElementById("gatewayList") as HTMLElement;

  // 1. Language detection and resource loading
  const isZh = navigator.language.startsWith("zh");
  const promptKey = isZh ? "prompt_zh" : "prompt_en";
  const initKey = isZh ? "init_zh" : "init_en";

  // Get current Tab ID
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTabId = tabs[0] ? tabs[0].id : null;

  if (!currentTabId) { return; }

  // Query Background for status
  chrome.runtime.sendMessage(
    { type: "GET_STATUS", tabId: currentTabId },
    (response: StatusResponse) => {
      if (response && response.connected) {
        connectedView.classList.remove("hidden");
        disconnectedView.classList.add("hidden");
        statusDot.classList.add("online");
        portDisplay.innerText = response.port ? response.port.toString() : "";

        // Populate Log switch status
        showLogInput.checked = response.showLog || false;
      } else {
        connectedView.classList.add("hidden");
        statusDot.classList.remove("online");

        // [Security] Only scan if URL is allowed
        const manifest = chrome.runtime.getManifest();
        const hostPatterns = manifest.host_permissions || [];
        const scriptPatterns = (manifest.content_scripts || []).flatMap((cs) => cs.matches || []);
        const patterns = [...new Set([...hostPatterns, ...scriptPatterns])];
        const currentUrl = tabs[0].url || "";

        const isAllowed = patterns.some((pattern) => {
          const base = pattern.replace(/\*$/, "");
          return currentUrl.startsWith(base) || currentUrl === base.replace(/\/$/, "");
        });

        if (!isAllowed) {
          availableView.classList.add("hidden");
          disconnectedView.classList.remove("hidden");
          return;
        }

        // Scan for existing gateways
        chrome.storage.local.get(null).then((items) => {
          const uniqueGateways = new Map<number, string>();
          for (const [key, val] of Object.entries(items)) {
            if (key.startsWith("session_") && (val as Session).port && (val as Session).token) {
              uniqueGateways.set((val as Session).port, (val as Session).token);
            }
          }

          if (uniqueGateways.size > 0) {
            availableView.classList.remove("hidden");
            disconnectedView.classList.add("hidden");
            gatewayList.innerHTML = "";

            uniqueGateways.forEach((token, port) => {
              const btn = document.createElement("button");
              btn.className = "btn";
              btn.style.marginBottom = "8px";
              btn.style.display = "flex";
              btn.style.justifyContent = "space-between";
              btn.innerHTML = `<span>🔗 Connect to <b>${port}</b></span> <span>⚡</span>`;
              btn.onclick = () => {
                chrome.runtime.sendMessage(
                  { type: "CONNECT_EXISTING", port, token, tabId: currentTabId },
                  (res: ExecuteToolResponse) => { if (res && res.success) { window.close(); } }
                );
              };
              gatewayList.appendChild(btn);
            });
          } else {
            availableView.classList.add("hidden");
            disconnectedView.classList.remove("hidden");
          }
        });
      }
    }
  );

  // 2. Copy Logic: Prompt
  copyPromptBtn.addEventListener("click", async () => {
    const local = await chrome.storage.local.get([promptKey]);
    const sync = await chrome.storage.sync.get(["user_rules"]);

    let promptContent = local[promptKey];
    const userRules = sync.user_rules || "";

    if (promptContent && userRules) {
      promptContent = `${promptContent}\n\n--- [User Rules] ---\n${userRules}`;
    }

    if (promptContent) {
      navigator.clipboard.writeText(promptContent as string).then(() => {
        const originalText = copyPromptBtn.innerText;
        copyPromptBtn.innerText = "Copied!";
        copyPromptBtn.style.backgroundColor = "#0d8a6a";
        setTimeout(() => {
          copyPromptBtn.innerText = originalText;
          copyPromptBtn.style.backgroundColor = "";
        }, 1500);
      });
    } else {
      copyPromptBtn.innerText = "Prompt Not Found";
    }
  });

  // 3. Copy Initialization Prompt
  copyInitBtn.addEventListener("click", async () => {
    const items = await chrome.storage.local.get([initKey]);
    const initContent = items[initKey];

    if (initContent) {
      navigator.clipboard.writeText(initContent as string).then(() => {
        const originalText = copyInitBtn.innerText;
        copyInitBtn.innerText = "Copied! Add to AI Memory";
        copyInitBtn.style.backgroundColor = "#0d8a6a";
        setTimeout(() => {
          copyInitBtn.innerText = originalText;
          copyInitBtn.style.backgroundColor = "";
        }, 3000);
      });
    } else {
      copyInitBtn.innerText = "Init Prompt Not Found";
    }
  });

  // Open Options Page
  openOptionsBtn?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Auto Send (Global Config)
  chrome.storage.sync.get(["autoSend"]).then((items) => {
    autoSendInput.checked = items.autoSend !== undefined ? items.autoSend : true;
  });

  autoSendInput.addEventListener("change", () => {
    chrome.storage.sync.set({ autoSend: autoSendInput.checked });
  });

  // Log Toggle (Tab Session)
  showLogInput.addEventListener("change", () => {
    chrome.runtime.sendMessage({
      type: "SET_LOG_VISIBLE",
      tabId: currentTabId,
      show: showLogInput.checked,
    });
  });
});

// To satisfy typescript unused variable constraint:
let _unusedType1: MessageRequest | null = null;
let _unusedType2: HandshakeResponse | null = null;
if (_unusedType1) {console.log(_unusedType1);}
if (_unusedType2) {console.log(_unusedType2);}
