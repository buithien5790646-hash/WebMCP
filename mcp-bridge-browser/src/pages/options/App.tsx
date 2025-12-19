import { useState, useEffect } from 'preact/hooks';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useStorage, useLocalStorage } from '@/hooks/useStorage';
import { useI18n } from '@/hooks/useI18n';
import { getLocal, setLocal } from '@/services/storage';
import { browserService } from '@/services/BrowserService';
import { i18n } from '@/services/i18n';
const { t } = i18n;
import './App.css';

export function App() {
    const { lang } = useI18n();
    const [protectedTools, setProtectedTools] = useStorage<string[]>('protected_tools', []);

    const promptKey = lang === 'zh' ? 'prompt_zh' : 'prompt_en';
    const trainKey = lang === 'zh' ? 'train_zh' : 'train_en';
    const errorKey = lang === 'zh' ? 'error_zh' : 'error_en';

    const [initPrompt, setInitPrompt] = useLocalStorage(promptKey, '');
    const [trainPrompt, setTrainPrompt] = useLocalStorage(trainKey, '');
    const [errorPrompt, setErrorPrompt] = useLocalStorage(errorKey, '');
    const [userRules, setUserRules] = useLocalStorage('user_rules', '');

    const [toolList, setToolList] = useState<string[]>([]);
    const [status, setStatus] = useState('');

    useEffect(() => {
        // Load cached tool list
        getLocal(['cached_tool_list']).then((items) => {
            if (items.cached_tool_list) {
                setToolList(items.cached_tool_list);
            }
        });
    }, []);

    const handleSave = () => {
        // Sync config to Gateway
        browserService.sendMessage({ type: 'SYNC_CONFIG' }).then((response) => {
            if (response?.success) {
                showStatus(t('status_saved_synced'));
            } else {
                showStatus(t('status_saved_local'));
            }
        });
    };

    const handleReset = async () => {
        if (confirm(t('confirm_reset'))) {
            // Load default prompts
            const promptFile = lang === 'zh' ? 'prompt_zh.md' : 'prompt.md';
            const trainFile = lang === 'zh' ? 'train_zh.md' : 'train.md';
            const errorFile = lang === 'zh' ? 'error_hint_zh.md' : 'error_hint.md';

            const loadDefault = async (filename: string) => {
                try {
                    const url = browserService.getURL(filename);
                    const resp = await fetch(url);
                    return await resp.text();
                } catch {
                    return '';
                }
            };

            setInitPrompt(await loadDefault(promptFile));
            setTrainPrompt(await loadDefault(trainFile));
            setErrorPrompt(await loadDefault(errorFile));
            setUserRules('');

            showStatus(t('status_reset_done'));
        }
    };

    const handleRefreshTools = async () => {
        try {
            // Find active session
            const all = await getLocal(null);
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

            await setLocal({ cached_tool_list: newToolNames });
            setToolList(newToolNames);
            showStatus(t('status_tools_updated'));
        } catch (e) {
            showStatus(t('status_gateway_failed'));
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
                <span>{t('opt_title')}</span>
                <span className="lang-badge">{lang.toUpperCase()}</span>
            </h1>

            <Card>
                <h2>{t('opt_hitl_title')}</h2>
                <div className="description">
                    {t('opt_hitl_desc')}
                    <Button
                        variant="secondary"
                        onClick={handleRefreshTools}
                        style={{ padding: '2px 8px', fontSize: '11px', marginLeft: '10px', display: 'inline-block', width: 'auto' }}
                    >
                        {t('btn_refresh_list')}
                    </Button>
                </div>
                <div className="tool-list">
                    {toolList.length === 0 ? (
                        <div style={{ color: '#999', fontStyle: 'italic', padding: '10px', textAlign: 'center' }}>
                            {t('opt_no_tools')}
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
                <h2>{t('opt_prompts_title')}</h2>

                <label>{t('opt_init_label')}</label>
                <div className="description">
                    {t('opt_init_desc')}
                </div>
                <textarea
                    value={initPrompt}
                    onChange={(e) => setInitPrompt((e.target as HTMLTextAreaElement).value)}
                    style={{ height: '180px' }}
                />

                <br /><br />

                <label style={{ color: '#007bff' }}>{t('opt_rules_label')}</label>
                <div className="description">
                    {t('opt_rules_desc')}
                </div>
                <textarea
                    value={userRules}
                    onChange={(e) => setUserRules((e.target as HTMLTextAreaElement).value)}
                    style={{ height: '80px', borderColor: '#b8daff', background: '#f0f8ff' }}
                />

                <br /><br />

                <label>{t('opt_train_label')}</label>
                <div className="description">
                    {t('opt_train_desc')}
                </div>
                <textarea
                    value={trainPrompt}
                    onChange={(e) => setTrainPrompt((e.target as HTMLTextAreaElement).value)}
                    style={{ height: '60px' }}
                />

                <br /><br />

                <label>{t('opt_error_label')}</label>
                <div className="description">
                    {t('opt_error_desc')}
                </div>
                <textarea
                    value={errorPrompt}
                    onChange={(e) => setErrorPrompt((e.target as HTMLTextAreaElement).value)}
                    style={{ height: '100px' }}
                />
            </Card>

            <div className="sticky-footer">
                <div className="footer-content">
                    <div className={`status ${status ? (status.includes('success') || status.includes('synced') || status.includes('更新') || status.includes('成功') || status.includes('恢复') ? 'status-success' : 'status-error') : ''}`}>
                        {status}
                    </div>
                    <div className="footer-actions">
                        <Button variant="secondary" onClick={handleReset}>{t('btn_reset')}</Button>
                        <Button onClick={handleSave}>{t('btn_save')}</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
