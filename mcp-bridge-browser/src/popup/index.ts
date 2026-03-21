import { Session, MessageRequest, HandshakeResponse, StatusResponse, ExecuteToolResponse } from '../types';

document.addEventListener("DOMContentLoaded", async () => {
  // 获取各种视图和控件元素的 DOM 引用
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

  // 1. 语言检测：决定读取中文还是英文的提示词
  const isZh = navigator.language.startsWith("zh");
  const promptKey = isZh ? "prompt_zh" : "prompt_en";
  const initKey = isZh ? "init_zh" : "init_en";

  // 获取当前活动标签页的 ID
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTabId = tabs[0] ? tabs[0].id : null;

  if (!currentTabId) { return; }

  // 向 Background 查询当前标签页的连接状态
  chrome.runtime.sendMessage(
    { type: "GET_STATUS", tabId: currentTabId },
    (response: StatusResponse) => {
      // 成功连接状态：显示在线 UI 和端口号
      if (response && response.connected) {
        connectedView.classList.remove("hidden");
        disconnectedView.classList.add("hidden");
        statusDot.classList.add("online");
        portDisplay.innerText = response.port ? response.port.toString() : "";

        // 回填悬浮日志开关状态
        showLogInput.checked = response.showLog || false;
      } else {
        // 未连接状态：隐藏在线 UI
        connectedView.classList.add("hidden");
        statusDot.classList.remove("online");

        // [安全控制] 只有在允许注入扩展的域名下，才尝试扫描可用的本地网关
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

        // 扫描全局 Local Storage 中已保存的其他有效网关连接信息
        chrome.storage.local.get(null).then((items) => {
          const uniqueGateways = new Map<number, string>();
          for (const [key, val] of Object.entries(items)) {
            // 如果发现了带有有效端口和 Token 的 session 记录
            if (key.startsWith("session_") && (val as Session).port && (val as Session).token) {
              uniqueGateways.set((val as Session).port, (val as Session).token);
            }
          }

          if (uniqueGateways.size > 0) {
            // 如果存在可用网关，显示一键连接列表
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
              // 点击按钮：将这个网关连接信息复用/绑定到当前标签页上
              btn.onclick = () => {
                chrome.runtime.sendMessage(
                  { type: "CONNECT_EXISTING", port, token, tabId: currentTabId },
                  (res: ExecuteToolResponse) => { if (res && res.success) { window.close(); } }
                );
              };
              gatewayList.appendChild(btn);
            });
          } else {
            // 没有可用网关，显示默认断开页面
            availableView.classList.add("hidden");
            disconnectedView.classList.remove("hidden");
          }
        });
      }
    }
  );

  // 2. 交互逻辑：复制主提示词到剪贴板
  copyPromptBtn.addEventListener("click", async () => {
    const local = await chrome.storage.local.get([promptKey]);
    const sync = await chrome.storage.sync.get(["user_rules"]);

    let promptContent = local[promptKey];
    const userRules = sync.user_rules || "";

    // 组合主提示词和用户自定义规则
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

  // 3. 交互逻辑：复制初始化设置提示词到剪贴板
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

  // 打开选项页面
  openOptionsBtn?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // 全局配置：切换自动发送功能
  chrome.storage.sync.get(["autoSend"]).then((items) => {
    autoSendInput.checked = items.autoSend !== undefined ? items.autoSend : true;
  });

  autoSendInput.addEventListener("change", () => {
    chrome.storage.sync.set({ autoSend: autoSendInput.checked });
  });

  // 当前会话配置：切换页面内悬浮日志窗口显示状态
  showLogInput.addEventListener("change", () => {
    chrome.runtime.sendMessage({
      type: "SET_LOG_VISIBLE",
      tabId: currentTabId,
      show: showLogInput.checked,
    });
  });
});

// 为了满足 TypeScript 编译器严格检查（标记并消除未使用变量警告）的临时代码：
let _unusedType1: MessageRequest | null = null;
let _unusedType2: HandshakeResponse | null = null;
if (_unusedType1) {console.log(_unusedType1);}
if (_unusedType2) {console.log(_unusedType2);}
