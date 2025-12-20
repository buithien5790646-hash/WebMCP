import { useState, useEffect } from 'preact/hooks';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useI18n } from '@/hooks/useI18n';
import { getLocal } from '@/services/storage';
import { i18n } from '@/services/i18n';
const { t } = i18n;
import './App.css';

export function App() {
    const { lang } = useI18n();
    const [config, setConfig] = useState<any>({
        prompt: '',
        train: '',
        error_hint: '',
        rules: '',
        protected_tools: [],
    });
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [toolGroups, setToolGroups] = useState<any[]>([]);
    const [status, setStatus] = useState('');
    const [saving, setSaving] = useState(false);
    const [activeGateway, setActiveGateway] = useState<{ port: number, token: string } | null>(null);

    useEffect(() => {
        // 1. Get workspaceId from URL
        const params = new URLSearchParams(window.location.search);
        let id = params.get('workspaceId');

        // 2. Find active session to get port/token
        getLocal(null).then(async (all) => {
            const sessions = Object.entries(all || {})
                .filter(([k]) => k.startsWith('session_'))
                .map(([_, v]) => v as any);

            let session = null;
            if (id) {
                session = sessions.find(s => s.workspaceId === id);
            }
            if (!session && sessions.length > 0) {
                session = sessions[0];
                id = session.workspaceId;
            }

            if (session) {
                setWorkspaceId(id);
                setActiveGateway({ port: session.port, token: session.token });
                loadConfig(session.port, session.token, id);
                refreshTools(session.port, session.token);
            } else {
                showStatus(t('status_gateway_failed'));
            }
        });
    }, []);

    const loadConfig = async (port: number, token: string, wId: string | null) => {
        try {
            const resp = await fetch(`http://127.0.0.1:${port}/v1/config?workspaceId=${wId || ''}`, {
                headers: { 'X-WebMCP-Token': token }
            });
            const data = await resp.json();
            if (data.config) {
                setConfig(data.config);
            }
        } catch (e) {
            console.error("Failed to load config", e);
        }
    };

    const refreshTools = async (port: number, token: string) => {
        try {
            const resp = await fetch(`http://127.0.0.1:${port}/v1/tools`, {
                headers: { 'X-WebMCP-Token': token }
            });
            const json = await resp.json();
            setToolGroups(json.groups || []);
        } catch (e) { }
    };

    const handleSave = async () => {
        if (!activeGateway || !workspaceId) return;
        setSaving(true);
        try {
            const resp = await fetch(`http://127.0.0.1:${activeGateway.port}/v1/config?workspaceId=${workspaceId}&scope=workspace`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WebMCP-Token': activeGateway.token
                },
                body: JSON.stringify({ config })
            });
            if (resp.ok) {
                showStatus(t('status_saved_synced'));
            } else {
                showStatus('Save Failed');
            }
        } catch (e) {
            showStatus('Network Error');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!activeGateway || !workspaceId) return;
        if (confirm(t('confirm_reset'))) {
            try {
                await fetch(`http://127.0.0.1:${activeGateway.port}/v1/config?workspaceId=${workspaceId}&scope=workspace`, {
                    method: 'DELETE',
                    headers: { 'X-WebMCP-Token': activeGateway.token }
                });
                await loadConfig(activeGateway.port, activeGateway.token, workspaceId);
                showStatus(t('status_reset_done'));
            } catch (e) {
                showStatus('Reset Failed');
            }
        }
    };

    const handleRefreshTools = () => {
        if (activeGateway) {
            refreshTools(activeGateway.port, activeGateway.token);
            showStatus(t('status_tools_updated'));
        }
    };

    const showStatus = (msg: string) => {
        setStatus(msg);
        setTimeout(() => setStatus(''), 3000);
    };

    const handleToolToggle = (toolName: string, checked: boolean) => {
        const current = config.protected_tools || [];
        const next = checked
            ? [...current, toolName]
            : current.filter((t: string) => t !== toolName);

        setConfig({ ...config, protected_tools: next });
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
                    {toolGroups.length === 0 ? (
                        <div style={{ color: '#999', fontStyle: 'italic', padding: '10px', textAlign: 'center' }}>
                            {t('opt_no_tools')}
                        </div>
                    ) : (
                        toolGroups.map((group: any) => (
                            <div key={group.server} className="tool-group">
                                <h3 className="group-title">{group.server}</h3>
                                {group.tools.map((tool: any) => (
                                    <label key={tool.name} className="checkbox-row">
                                        <input
                                            type="checkbox"
                                            checked={(config.protected_tools || []).includes(tool.name)}
                                            onChange={(e) => handleToolToggle(tool.name, (e.target as HTMLInputElement).checked)}
                                        />
                                        <span className="tool-name">{tool.name}</span>
                                        {tool.description && <span className="tool-desc">- {tool.description}</span>}
                                    </label>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            </Card>

            <Card>
                <h2>{t('opt_prompts_title')}</h2>
                {workspaceId && <div className="workspace-badge">Project: {workspaceId.slice(0, 8)}...</div>}

                <label>{t('opt_init_label')}</label>
                <div className="description">
                    {t('opt_init_desc')}
                </div>
                <textarea
                    value={config.prompt}
                    onInput={(e) => setConfig({ ...config, prompt: (e.target as HTMLTextAreaElement).value })}
                    style={{ height: '180px' }}
                />

                <br /><br />

                <label style={{ color: '#007bff' }}>{t('opt_rules_label')}</label>
                <div className="description">
                    {t('opt_rules_desc')}
                </div>
                <textarea
                    value={config.rules}
                    onInput={(e) => setConfig({ ...config, rules: (e.target as HTMLTextAreaElement).value })}
                    style={{ height: '80px', borderColor: '#b8daff', background: '#f0f8ff' }}
                />

                <br /><br />

                <label>{t('opt_train_label')}</label>
                <div className="description">
                    {t('opt_train_desc')}
                </div>
                <textarea
                    value={config.train}
                    onInput={(e) => setConfig({ ...config, train: (e.target as HTMLTextAreaElement).value })}
                    style={{ height: '60px' }}
                />

                <br /><br />

                <label>{t('opt_error_label')}</label>
                <div className="description">
                    {t('opt_error_desc')}
                </div>
                <textarea
                    value={config.error_hint}
                    onInput={(e) => setConfig({ ...config, error_hint: (e.target as HTMLTextAreaElement).value })}
                    style={{ height: '100px' }}
                />
            </Card>

            <div className="sticky-footer">
                <div className="footer-content">
                    <div className={`status ${status ? (status.includes('success') || status.includes('synced') || status.includes('更新') || status.includes('成功') || status.includes('恢复') ? 'status-success' : 'status-error') : ''}`}>
                        {status}
                    </div>
                    <div className="footer-actions">
                        <Button variant="secondary" onClick={handleReset} disabled={saving}>{t('btn_reset')}</Button>
                        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : t('btn_save')}</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
