import { HandshakeResponse } from "@/types";
import { browserService } from "@/services/BrowserService";

const init = () => {
  console.log("[WebMCP] Bridge Script Loaded, state:", document.readyState);

  const startHandshake = () => {
    console.log("[WebMCP] Bridge DOM Loaded, starting handshake...");

    // 标记插件已安装，供页面检测
    if (document.documentElement) {
      document.documentElement.setAttribute("data-extension-installed", "true");
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const target = params.get("target");
    let workspaceId = params.get("workspaceId");
    const portStr = window.location.port;

    // Fallback: Check if workspaceId is in data-workspace-id (used by Desktop app)
    if (!workspaceId) {
      const dataEl = document.getElementById("mcp-data");
      if (dataEl) {
        workspaceId = dataEl.getAttribute("data-workspace-id");
      }
    }

    const loader = document.getElementById("loader") as HTMLElement | null;
    const statusText = document.querySelector("p") as HTMLElement | null;
    const card = document.getElementById("main-card") as HTMLElement | null;

    if (!token || !target || !portStr) {
      if (statusText) {
        statusText.innerText = "Invalid Link Parameters";
        statusText.style.color = "#ff6b6b";
      }
      return;
    }

    const port = parseInt(portStr);

    function attemptHandshake(force = false) {
      browserService
        .sendMessage({
          type: "HANDSHAKE",
          port: port,
          token: token,
          workspaceId: workspaceId,
          force: force,
        })
        .then((response: HandshakeResponse) => {
          if (!response) {
            if (statusText && loader) {
              statusText.innerHTML = `
                          <span style="color:#ff6b6b">❌ Extension Not Detected</span><br>
                          <span style="font-size:0.8em; opacity:0.8">Please ensure 'WebMCP Bridge' extension is installed and enabled.</span>
                      `;
              loader.style.display = "none";
            }
            return;
          }

          if (!statusText || !loader || !card) return;

          if (response && response.success) {
            statusText.innerText = "✅ Connected! Redirecting...";
            statusText.style.color = "#4CAF50";
            setTimeout(() => {
              window.location.href = target as string;
            }, 500);
          } else if (response && response.error === "BUSY") {
            // === 冲突处理 UI ===
            loader.style.display = "none";
            statusText.innerHTML = `
                        <span style="color:#f39c12; font-weight:bold">⚠️ Connection Conflict</span><br><br>
                        VS Code (Port ${port}) is already connected to another tab.<br>
                        Do you want to switch the connection here?
                    `;

            const oldBtn = card.querySelector("button");
            if (oldBtn) oldBtn.remove();

            const btn = document.createElement("button");
            btn.innerText = "Yes, Connect Here";
            btn.style.marginTop = "20px";
            btn.onclick = () => {
              statusText.innerText = "Switching connection...";
              loader.style.display = "block";
              btn.remove();
              attemptHandshake(true);
            };
            card.appendChild(btn);
          } else {
            statusText.innerText = `Connection Failed: ${
              response ? response.error : "Unknown Error"
            }`;
            statusText.style.color = "#ff6b6b";
          }
        });
    }

    // 启动握手
    attemptHandshake();
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    startHandshake();
  } else {
    window.addEventListener("DOMContentLoaded", startHandshake);
  }
};

init();
