import { useState, useEffect } from 'preact/hooks';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { StatusDot } from '@/components/StatusDot';
import { useStorage, useLocalStorage } from '@/hooks/useStorage';
import { getLocal } from '@/services/storage';
import { browserService } from '@/services/BrowserService';
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
        // Get status and tab info when popup opens
        browserService.getActiveTab().then((tab) => {
            const tabId = tab?.id;
            if (!tabId) return;
            setCurrentTabId(tabId);
            setActiveTabUrl(tab.url || '');

            // Get status from background
            browserService.sendMessage({ type: 'GET_STATUS', tabId }).then((response) => {
                if (response?.connected) {
                    setStatus({
                        connected: true,
                        port: response.port,
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
        browserService.openOptionsPage();
    };

    const handleConnectGateway = (gateway: Gateway) => {
        if (!currentTabId) return;
        browserService.sendMessage({
            type: 'CONNECT_EXISTING',
            port: gateway.port,
            token: gateway.token,
            tabId: currentTabId,
        }).then((res) => {
            if (res?.success) {
                window.close();
            }
        });
    };

    const handleToggleLog = (checked: boolean) => {
        setShowLog(checked);
        if (currentTabId) {
            browserService.sendMessage({
                type: 'SET_LOG_VISIBLE',
                tabId: currentTabId,
                show: checked,
            });
        }
    };

    const [activeTabUrl, setActiveTabUrl] = useState<string>('');

    const isSupportedSite = (url?: string) => {
        if (!url) return false;
        const supported = ['chatgpt.com', 'gemini.google.com', 'aistudio.google.com', 'chat.deepseek.com'];
        return supported.some(domain => url.includes(domain));
    };

    const onSupportedSite = isSupportedSite(activeTabUrl);

    return (
        <div className="popup-container">
            <h2>
                <StatusDot online={status.connected} />
                WebMCP Bridge
            </h2>

            {status.connected ? (
                <div>
                    <Card>
                        <p style={{ marginBottom: '8px', color: 'var(--color-success)' }}>✅ Connected to VS Code</p>
                        <p style={{ fontSize: '11px', opacity: 0.7 }}>
                            Port: <span>{status.port || '-'}</span>
                        </p>
                    </Card>
                    <Button onClick={handleCopyPrompt}>Copy System Prompt</Button>
                    <Button variant="secondary" onClick={handleOpenOptions} style={{ marginTop: '8px' }}>
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
            ) : onSupportedSite && gateways.length > 0 ? (
                <div>
                    <Card style={{ border: '1px solid var(--color-primary)' }}>
                        <h3 style={{ color: 'var(--color-primary)', margin: '0 0 10px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                    <Button variant="secondary" onClick={handleOpenOptions}>
                        Open Settings
                    </Button>
                </div>
            ) : (
                <div>
                    <Card style={{ padding: '15px 10px', border: '1px solid #555' }}>
                        <h3 style={{ color: 'var(--color-error)', margin: '0 0 10px 0', fontSize: '14px', textAlign: 'center' }}>
                            {onSupportedSite ? '🔴 Disconnected' : '💡 Instructions'}
                        </h3>
                        <div style={{ marginBottom: '15px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                            <p style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold', marginBottom: '5px' }}>
                                👉 {isZh ? '如何启动？' : 'Already Installed?'}
                            </p>
                            <p style={{ fontSize: '11px', color: '#ccc', lineHeight: 1.4 }}>
                                {isZh ? (
                                    <>点击 VS Code 状态栏（右下角）的 <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>WebMCP</span> 并按照步骤启动。</>
                                ) : (
                                    <>Click <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>WebMCP</span> in VS Code Status Bar (bottom right) and follow the steps to launch.</>
                                )}
                            </p>
                        </div>
                        <div>
                            <p style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold', marginBottom: '5px' }}>
                                👉 {isZh ? '尚未安装？' : 'Not Installed?'}
                            </p>
                            <div style={{ background: '#333', padding: '8px', borderRadius: '4px', margin: '5px 0' }}>
                                <p style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>
                                    {isZh ? '在 VS Code 插件市场搜索：' : 'Search in VS Code Marketplace:'}
                                </p>
                                <p style={{ fontWeight: 'bold', color: 'var(--color-success)', fontSize: '12px' }}>
                                    WebMCP Gateway
                                </p>
                            </div>
                        </div>
                    </Card>
                    <Button variant="secondary" onClick={handleOpenOptions}>
                        Open Settings
                    </Button>
                </div>
            )}
        </div>
    );
}
