import { useState, useEffect } from 'preact/hooks';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useStorage, useLocalStorage } from '../../hooks/useStorage';
import { useI18n } from '../../hooks/useI18n';
import { DEFAULT_SELECTORS } from '../../modules/config';
import './App.css';

export function App() {
    const { lang } = useI18n();
    const [customSelectors, setCustomSelectors] = useStorage('customSelectors', DEFAULT_SELECTORS);
    const [protectedTools, setProtectedTools] = useStorage<string[]>('protected_tools', []);

    const promptKey = lang === 'zh' ? 'prompt_zh' : 'prompt_en';
    const trainKey = lang === 'zh' ? 'train_zh' : 'train_en';
    const errorKey = lang === 'zh' ? 'error_zh' : 'error_en';

    const [initPrompt, setInitPrompt] = useLocalStorage(promptKey, '');
    const [trainPrompt, setTrainPrompt] = useLocalStorage(trainKey, '');
    const [errorPrompt, setErrorPrompt] = useLocalStorage(errorKey, '');
    const [userRules, setUserRules] = useLocalStorage('user_rules', '');

    const [selectorsJson, setSelectorsJson] = useState('');
    const [toolList, setToolList] = useState<string[]>([]);
    const [status, setStatus] = useState('');

    useEffect(() => {
        setSelectorsJson(JSON.stringify(customSelectors, null, 2));
    }, [customSelectors]);

    useEffect(() => {
        // Load cached tool list
        chrome.storage.local.get(['cached_tool_list'], (items) => {
            if (items.cached_tool_list) {
                setToolList(items.cached_tool_list);
            }
        });
    }, []);

    const handleSave = () => {
        try {
            const config = JSON.parse(selectorsJson);
            if (!config.deepseek || !config.chatgpt || !config.gemini || !config.aistudio) {
                throw new Error('Missing required platform keys');
            }
            setCustomSelectors(config);

            // Sync config to Gateway
            chrome.runtime.sendMessage({ type: 'SYNC_CONFIG' }, (response) => {
                if (response?.success) {
                    showStatus('Settings saved & synced to VS Code!');
                } else {
                    showStatus('Saved locally (VS Code disconnected).');
                }
            });
        } catch (e: any) {
            showStatus('Error: Invalid JSON format. ' + e.message);
        }
    };

    const handleReset = async () => {
        if (confirm('Are you sure you want to reset ALL settings to defaults?')) {
            setSelectorsJson(JSON.stringify(DEFAULT_SELECTORS, null, 2));

            // Load default prompts
            const promptFile = lang === 'zh' ? 'prompt_zh.md' : 'prompt.md';
            const trainFile = lang === 'zh' ? 'train_zh.md' : 'train.md';
            const errorFile = lang === 'zh' ? 'error_hint_zh.md' : 'error_hint.md';

            const loadDefault = async (filename: string) => {
                try {
                    const url = chrome.runtime.getURL(filename);
                    const resp = await fetch(url);
                    return await resp.text();
                } catch {
                    return '';
                }
            };

            setInitPrompt(await loadDefault(promptFile));
            setTrainPrompt(await loadDefault(trainFile));
            setErrorPrompt(await loadDefault(errorFile));

            showStatus('Restored defaults from files.');
        }
    };

    const handleRefreshTools = async () => {
        try {
            // Find active session
            const all = await chrome.storage.local.get(null);
            const entries = Object.entries(all || {});
            let port = null, token = null;
            for (const [key, val] of entries) {
                if (key.startsWith('session_') && (val as any).port && (val as any).token) {
                    port = (val as any).port;
                    token = (val as any).token;
                    break;
                }
            }
            if (!port || !token) throw new Error('No active session');

            const resp = await fetch(`http://127.0.0.1:${port}/v1/tools`, {
                headers: { 'X-WebMCP-Token': token },
            });
            if (!resp.ok) throw new Error('Gateway rejected request');

            const json = await resp.json();
            const rawGroups = json.groups || [];
            const newToolNames: string[] = [];
            rawGroups.forEach((g: any) => {
                if (g.tools) g.tools.forEach((t: any) => newToolNames.push(t.name));
                if (g.hidden_tools) g.hidden_tools.forEach((n: string) => newToolNames.push(n));
            });

            await chrome.storage.local.set({ cached_tool_list: newToolNames });
            setToolList(newToolNames);
            showStatus('Tool list updated!');
        } catch (e) {
            showStatus('Failed to connect to Gateway.');
        }
    };

    const showStatus = (msg: string) => {
        setStatus(msg);
        setTimeout(() => setStatus(''), 3000);
    };

    const handleToolToggle = (toolName: string, checked: boolean) => {
        if (checked) {
            setProtectedTools([...protectedTools, toolName]);
        } else {
            setProtectedTools(protectedTools.filter(t => t !== toolName));
        }
    };

    return (
        <div className="options-container">
            <h1>
                <span>WebMCP Settings</span>
                <span className="lang-badge">{lang.toUpperCase()}</span>
            </h1>

            <Card>
                <h2>Site Selectors</h2>
                <div className="description">
                    Customize DOM selectors. Only modify if the extension stops working.
                </div>
                <textarea
                    value={selectorsJson}
                    onChange={(e) => setSelectorsJson((e.target as HTMLTextAreaElement).value)}
                    style={{ height: '150px' }}
                />
            </Card>

            <Card>
                <h2>Human-in-the-Loop (Approval)</h2>
                <div className="description">
                    Select tools that require manual approval before execution.
                    <Button
                        variant="secondary"
                        onClick={handleRefreshTools}
                        style={{ padding: '2px 8px', fontSize: '11px', marginLeft: '10px', display: 'inline-block', width: 'auto' }}
                    >
                        🔄 Refresh List
                    </Button>
                </div>
                <div className="tool-list">
                    {toolList.length === 0 ? (
                        <div style={{ color: '#999', fontStyle: 'italic', padding: '10px', textAlign: 'center' }}>
                            No tools detected yet. Please use the extension once.
                        </div>
                    ) : (
                        toolList.map((toolName) => (
                            <label key={toolName} className="checkbox-row">
                                <input
                                    type="checkbox"
                                    checked={protectedTools.includes(toolName)}
                                    onChange={(e) => handleToolToggle(toolName, (e.target as HTMLInputElement).checked)}
                                />
                                {toolName}
                            </label>
                        ))
                    )}
                </div>
            </Card>

            <Card>
                <h2>System Prompts</h2>

                <label>Initial System Prompt</label>
                <div className="description">
                    Sent to AI when you start a new conversation. (Supports Markdown)
                </div>
                <textarea
                    value={initPrompt}
                    onChange={(e) => setInitPrompt((e.target as HTMLTextAreaElement).value)}
                    style={{ height: '180px' }}
                />

                <br /><br />

                <label style={{ color: '#007bff' }}>User Rules (Custom Preferences)</label>
                <div className="description">
                    Your personal requirements (e.g., "Always ask before coding"). Appended to System & Training prompts.
                </div>
                <textarea
                    value={userRules}
                    onChange={(e) => setUserRules((e.target as HTMLTextAreaElement).value)}
                    style={{ height: '80px', borderColor: '#b8daff', background: '#f0f8ff' }}
                />

                <br /><br />

                <label>Training Hint (Periodic)</label>
                <div className="description">
                    Inserted periodically (every 5 tool calls) to remind AI of the protocol.
                </div>
                <textarea
                    value={trainPrompt}
                    onChange={(e) => setTrainPrompt((e.target as HTMLTextAreaElement).value)}
                    style={{ height: '60px' }}
                />

                <br /><br />

                <label>Format Error Hint</label>
                <div className="description">
                    Sent to AI when it generates invalid JSON or fails to follow protocol.
                </div>
                <textarea
                    value={errorPrompt}
                    onChange={(e) => setErrorPrompt((e.target as HTMLTextAreaElement).value)}
                    style={{ height: '100px' }}
                />
            </Card>

            <div className="sticky-footer">
                <div className="footer-content">
                    <div className={`status ${status ? (status.includes('success') || status.includes('synced') ? 'status-success' : 'status-error') : ''}`}>
                        {status}
                    </div>
                    <Button variant="secondary" onClick={handleReset}>Reset to Defaults</Button>
                    <Button onClick={handleSave}>Save Settings</Button>
                </div>
            </div>
        </div>
    );
}
