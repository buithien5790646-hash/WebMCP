import { useState, useEffect } from "preact/hooks";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StatusDot } from "@/components/StatusDot";
import { useStorage, useLocalStorage } from "@/hooks/useStorage";
import { getLocal } from "@/services/storage";
import { browserService } from "@/services/BrowserService";
import { i18n } from "@/services/i18n";
const { t } = i18n;
import "./App.css";

interface SessionStatus {
  connected: boolean;
  port?: number;
  workspaceId?: string;
  showLog?: boolean;
}

interface Gateway {
  port: number;
  token: string;
}

export function App() {
  const [status, setStatus] = useState<SessionStatus>({ connected: false });
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const [autoSend, setAutoSend] = useStorage("autoSend", true, status.workspaceId);
  const [showLog, setShowLog] = useState(false);
  const [copied, setCopied] = useState(false);

  const promptKey = i18n.lang === "zh" ? "prompt_zh" : "prompt_en";
  const [promptContent] = useLocalStorage(promptKey, "", status.workspaceId);
  const [userRules] = useLocalStorage("user_rules", "", status.workspaceId);

  useEffect(() => {
    // Get status and tab info when popup opens
    browserService.getActiveTab().then((tab) => {
      const tabId = tab?.id;
      if (!tabId) return;
      setCurrentTabId(tabId);
      setActiveTabUrl(tab.url || "");

      // Get status from background
      browserService.sendMessage({ type: "GET_STATUS", tabId }).then((response) => {
        if (response?.connected) {
          setStatus({
            connected: true,
            port: response.port,
            workspaceId: response.workspaceId,
            showLog: response.showLog || false,
          });
          setShowLog(response.showLog || false);
        } else {
          // Scan for available sessions
          scanGateways();
        }
      });
    });
  }, []);

  const scanGateways = () => {
    getLocal(null).then((items) => {
      const uniqueGateways = new Map<number, string>();
      for (const [key, val] of Object.entries(items || {})) {
        if (key.startsWith("session_") && (val as any).port && (val as any).token) {
          uniqueGateways.set((val as any).port, (val as any).token);
        }
      }

      const gatewayList: Gateway[] = [];
      uniqueGateways.forEach((token, port) => {
        gatewayList.push({ port, token });
      });
      setGateways(gatewayList);
    });
  };

  const handleCopyPrompt = async () => {
    let content = promptContent;
    let rules = userRules;

    // Fallback: If local storage is empty but we are connected, fetch from gateway
    if (!content && status.connected && status.port) {
      try {
        const resp = await fetch(
          `http://127.0.0.1:${status.port}/v1/config?workspaceId=${status.workspaceId || ""}`
        );
        const data = await resp.json();
        if (data.config) {
          content = data.config.prompt;
          rules = data.config.rules;
        }
      } catch (e) {
        console.error("Failed to fetch config for copy", e);
      }
    }

    if (rules) {
      content = content ? `${content}\n\n--- [User Rules] ---\n${rules}` : rules;
    }

    if (content) {
      navigator.clipboard.writeText(content).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      alert(t("opt_no_tools")); // Or a better "no prompt available" message
    }
  };

  const handleOpenOptions = () => {
    let path = "src/pages/options/index.html";
    if (status.workspaceId) {
      path += `?workspaceId=${status.workspaceId}`;
    }
    chrome.tabs.create({ url: chrome.runtime.getURL(path) });
  };
  const handleConnectGateway = (gateway: Gateway) => {
    if (!currentTabId) return;
    browserService
      .sendMessage({
        type: "CONNECT_EXISTING",
        port: gateway.port,
        token: gateway.token,
        tabId: currentTabId,
      })
      .then((res) => {
        if (res?.success) {
          window.close();
        }
      });
  };

  const handleToggleLog = (checked: boolean) => {
    setShowLog(checked);
    if (currentTabId) {
      browserService.sendMessage({
        type: "SET_LOG_VISIBLE",
        tabId: currentTabId,
        show: checked,
      });
    }
  };

  const [activeTabUrl, setActiveTabUrl] = useState<string>("");

  const isSupportedSite = (url?: string) => {
    if (!url) return false;
    const supported = [
      "chatgpt.com",
      "gemini.google.com",
      "aistudio.google.com",
      "chat.deepseek.com",
    ];
    return supported.some((domain) => url.includes(domain));
  };

  const onSupportedSite = isSupportedSite(activeTabUrl);

  return (
    <div className="popup-container">
      <h2>
        <StatusDot online={status.connected} />
        {t("popup_title")}
      </h2>

      {status.connected ? (
        <div>
          <Card>
            <p style={{ marginBottom: "8px", color: "var(--color-success)" }}>
              {t("popup_connected")}
            </p>
            <p style={{ fontSize: "11px", opacity: 0.7 }}>
              {t("popup_port")}: <span>{status.port || "-"}</span>
            </p>
          </Card>
          <Button onClick={handleCopyPrompt}>
            {copied ? t("btn_copied") : t("btn_copy_prompt")}
          </Button>
          <Button variant="secondary" onClick={handleOpenOptions} style={{ marginTop: "8px" }}>
            {t("btn_settings")}
          </Button>
          <Card style={{ marginTop: "10px" }}>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={autoSend}
                onChange={(e) => setAutoSend((e.target as HTMLInputElement).checked)}
              />
              {t("popup_auto_send")}
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={showLog}
                onChange={(e) => handleToggleLog((e.target as HTMLInputElement).checked)}
              />
              {t("popup_show_log")}
            </label>
          </Card>
        </div>
      ) : onSupportedSite && gateways.length > 0 ? (
        <div>
          <Card style={{ border: "1px solid var(--color-primary)" }}>
            <h3
              style={{
                color: "var(--color-primary)",
                margin: "0 0 10px 0",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>⚡</span> {t("popup_gateways")}
            </h3>
            <div>
              {gateways.map((gw) => (
                <Button
                  key={gw.port}
                  onClick={() => handleConnectGateway(gw)}
                  style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between" }}
                >
                  <span>
                    🔗 {t("btn_connect_to")} <b>{gw.port}</b>
                  </span>{" "}
                  <span>⚡</span>
                </Button>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <div>
          <Card style={{ padding: "15px 10px", border: "1px solid #555" }}>
            <h3
              style={{
                color: "var(--color-error)",
                margin: "0 0 10px 0",
                fontSize: "14px",
                textAlign: "center",
              }}
            >
              {onSupportedSite ? t("popup_status_disconnected") : t("popup_status_instructions")}
            </h3>
            <div
              style={{
                marginBottom: "15px",
                borderBottom: "1px solid #444",
                paddingBottom: "10px",
              }}
            >
              <p
                style={{ fontSize: "12px", color: "#fff", fontWeight: "bold", marginBottom: "5px" }}
              >
                👉 {t("instr_how_to_start")}
              </p>
              <p style={{ fontSize: "11px", color: "#ccc", lineHeight: 1.4 }}>
                {t("instr_step_1")}
              </p>
            </div>
            <div>
              <p
                style={{ fontSize: "12px", color: "#fff", fontWeight: "bold", marginBottom: "5px" }}
              >
                👉 {t("instr_not_installed")}
              </p>
              <div
                style={{ background: "#333", padding: "8px", borderRadius: "4px", margin: "5px 0" }}
              >
                <p style={{ fontSize: "10px", color: "#888", marginBottom: "2px" }}>
                  {t("instr_search_marketplace")}
                </p>
                <p style={{ fontWeight: "bold", color: "var(--color-success)", fontSize: "12px" }}>
                  WebMCP Gateway
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
