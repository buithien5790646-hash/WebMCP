import { useState, useEffect } from 'preact/hooks';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { StatusDot } from '../../components/StatusDot';
import { useStorage, useLocalStorage } from '../../hooks/useStorage';
import './App.css';

interface SessionStatus {
    connected: boolean;
    port?: number;
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
    const [autoSend, setAutoSend] = useStorage('autoSend', true);
    const [showLog, setShowLog] = useState(false);

    const isZh = navigator.language.startsWith('zh');
    const promptKey = isZh ? 'prompt_zh' : 'prompt_en';
    const [promptContent] = useLocalStorage(promptKey, '');
    const [userRules] = useLocalStorage('user_rules', '');

    useEffect(() => {
        // Get current tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0]?.id;
            if (!tabId) return;
            setCurrentTabId(tabId);

            // Get status
            chrome.runtime.sendMessage({ type: 'GET_STATUS', tabId }, (response) => {
                if (response?.connected) {
                    setStatus({
                        connected: true,
                        port: response.port,
                        showLog: response.showLog || false,
                    });
                    setShowLog(response.showLog || false);
                } else {
                    // Scan for available gateways
                    scanGateways();
                }
            });
        });
    }, []);

    const scanGateways = () => {
        chrome.storage.local.get(null, (items) => {
            const uniqueGateways = new Map<number, string>();
            for (const [key, val] of Object.entries(items)) {
                if (key.startsWith('session_') && (val as any).port && (val as any).token) {
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

    const handleCopyPrompt = () => {
        let content = promptContent;
        if (userRules) {
            content = `${content}\n\n--- [User Rules] ---\n${userRules}`;
        }
        if (content) {
            navigator.clipboard.writeText(content);
        }
    };

    const handleOpenOptions = () => {
        chrome.runtime.openOptionsPage();
    };

    const handleConnectGateway = (gateway: Gateway) => {
        if (!currentTabId) return;
        chrome.runtime.sendMessage(
            {
                type: 'CONNECT_EXISTING',
                port: gateway.port,
                token: gateway.token,
                tabId: currentTabId,
            },
            (res) => {
                if (res?.success) {
                    window.close();
                }
            }
        );
    };

    const handleToggleLog = (checked: boolean) => {
        setShowLog(checked);
        if (currentTabId) {
            chrome.runtime.sendMessage({
                type: 'SET_LOG_VISIBLE',
                tabId: currentTabId,
                show: checked,
            });
        }
    };

    return (
        <div className="popup-container">
            <h2>
                <StatusDot online={status.connected} />
                WebMCP Bridge
            </h2>

            {status.connected ? (
                <div>
                    <Card>
                        <p style={{ marginBottom: '8px' }}>✅ Connected to VS Code</p>
                        <p style={{ fontSize: '11px', opacity: 0.7 }}>
                            Port: <span>{status.port || '-'}</span>
                        </p>
                    </Card>
                    <Button onClick={handleCopyPrompt}>Copy System Prompt</Button>
                    <Button variant="secondary" onClick={handleOpenOptions}>
                        Open Settings
                    </Button>
                    <Card style={{ marginTop: '10px' }}>
                        <label className="checkbox-row">
                            <input
                                type="checkbox"
                                checked={autoSend}
                                onChange={(e) => setAutoSend((e.target as HTMLInputElement).checked)}
                            />
                            Auto Send Message
                        </label>
                        <label className="checkbox-row">
                            <input
                                type="checkbox"
                                checked={showLog}
                                onChange={(e) => handleToggleLog((e.target as HTMLInputElement).checked)}
                            />
                            Show Floating Log
                        </label>
                    </Card>
                </div>
            ) : gateways.length > 0 ? (
                <div>
                    <Card style={{ border: '1px solid #3498db' }}>
                        <h3 style={{ color: '#3498db', margin: '0 0 10px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>⚡</span> Available Gateways
                        </h3>
                        <div>
                            {gateways.map((gw) => (
                                <Button
                                    key={gw.port}
                                    onClick={() => handleConnectGateway(gw)}
                                    style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}
                                >
                                    <span>🔗 Connect to <b>{gw.port}</b></span> <span>⚡</span>
                                </Button>
                            ))}
                        </div>
                    </Card>
                </div>
            ) : (
                <div>
                    <Card style={{ padding: '15px 10px', border: '1px solid #555' }}>
                        <h3 style={{ color: '#e74c3c', margin: '0 0 10px 0', fontSize: '14px', textAlign: 'center' }}>
                            🔴 Disconnected
                        </h3>
                        <div style={{ marginBottom: '15px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                            <p style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold', marginBottom: '5px' }}>
                                👉 Already Installed?
                            </p>
                            <p style={{ fontSize: '11px', color: '#ccc', lineHeight: 1.4 }}>
                                Click <span style={{ color: '#3498db', fontWeight: 'bold' }}>WebMCP</span> in VS Code Status Bar (bottom right) and follow the steps to launch.
                            </p>
                        </div>
                        <div>
                            <p style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold', marginBottom: '5px' }}>
                                👉 Not Installed?
                            </p>
                            <div style={{ background: '#333', padding: '8px', borderRadius: '4px', margin: '5px 0' }}>
                                <p style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>
                                    Search in VS Code Marketplace:
                                </p>
                                <p style={{ fontWeight: 'bold', color: '#4caf50', fontSize: '12px' }}>
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
