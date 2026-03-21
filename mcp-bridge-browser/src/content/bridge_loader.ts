import { HandshakeResponse } from '../types';

/**
 * 桥接页面加载器
 * 注入到 VS Code 生成的本地中转网页（bridge.html）中，负责自动读取 URL 中的认证参数，
 * 向扩展后台发起连接握手请求，并在连接成功后自动跳转到目标 AI 对话网页。
 */
(function () {
  // === 核心机制：标记插件安装状态 ===
  // 在文档根元素上注入标记属性。VS Code 生成的中转网页会检查此属性，
  // 若短时间内未检测到，则说明用户未安装插件，页面会显示错误提示。
  document.documentElement.setAttribute("data-extension-installed", "true");

  function startHandshake() {
    console.log("[WebMCP] Bridge starting handshake...");

    // 1. 从 URL 查询字符串中提取连接参数
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const target = params.get("target");
    // 假设网关与当前中转页在同一端口运行
    const portStr = window.location.port;

    // 获取嵌在 HTML 中的工作区 ID 标识
    const dataEl = document.getElementById("mcp-data");
    const workspaceId = dataEl ? dataEl.getAttribute("data-workspace-id") : "global";

    // 绑定 UI 元素以更新连接状态反馈
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

    /**
     * 尝试发送握手请求给扩展后台 (Background Script)
     * @param force 是否强制覆盖其他标签页已建立的同端口连接
     */
    function attemptHandshake(force = false) {
      chrome.runtime.sendMessage(
        {
          type: "HANDSHAKE",
          port: port,
          token: token,
          workspaceId: workspaceId,
          force: force,
        },
        (response: HandshakeResponse) => {
          // 处理与扩展后台通信失败的情况（比如扩展被禁用或崩溃）
          if (chrome.runtime.lastError) {
            console.error("[WebMCP] Runtime error during handshake:", chrome.runtime.lastError);
            if (statusText && loader) {
                statusText.innerHTML = `
                            <span style="color:#ff6b6b">❌ Extension Not Detected</span><br>
                            <span style="font-size:0.8em; opacity:0.8">Please ensure 'WebMCP Bridge' extension is installed and enabled.</span>
                        `;
                loader.style.display = "none";
            }
            return;
          }

          if (!statusText || !loader || !card) {return;}

          if (response && response.success) {
            // 握手成功：更新 UI 并延迟跳转到目标 AI 网站
            statusText.innerText = "✅ Connected! Redirecting...";
            statusText.style.color = "#4CAF50";
            setTimeout(() => {
              window.location.href = target as string;
            }, 500);
          } else if (response && response.error === "BUSY") {
            // === 冲突处理逻辑 ===
            // 发现该端口已经与另一个标签页绑定了会话，询问用户是否强制在此处重建连接
            loader.style.display = "none";
            statusText.innerHTML = `
                        <span style="color:#f39c12; font-weight:bold">⚠️ Connection Conflict</span><br><br>
                        VS Code (Port ${port}) is already connected to another tab.<br>
                        Do you want to switch the connection here?
                    `;

            // 清理旧的重试按钮（如果有的话）
            const oldBtn = card.querySelector("button");
            if (oldBtn) {oldBtn.remove();}

            // 动态创建强制连接的按钮
            const btn = document.createElement("button");
            btn.innerText = "Yes, Connect Here";
            btn.style.marginTop = "20px";
            btn.onclick = () => {
              statusText.innerText = "Switching connection...";
              loader.style.display = "block";
              btn.remove();
              // 再次发起握手请求并声明强制覆盖
              attemptHandshake(true);
            };
            card.appendChild(btn);
          } else {
            // 其他未知错误
            statusText.innerText = `Connection Failed: ${
              response ? response.error : "Unknown Error"
            }`;
            statusText.style.color = "#ff6b6b";
          }
        }
      );
    }

    // 初始化流程：发起第一次握手尝试
    attemptHandshake();
  }

  // 确保 DOM 加载完成后再执行握手流程
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", startHandshake);
  } else {
    startHandshake();
  }
})();
