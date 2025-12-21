import { render } from 'preact';
import { useState } from 'preact/hooks';
import { ToolExecutionPayload } from '@/types';
import { useI18n } from '@/hooks/useI18n';
import styles from './ConfirmModal.css?inline';

interface ConfirmModalProps {
    payload: ToolExecutionPayload;
    onConfirm: (always: boolean) => void;
    onReject: (reason: string) => void;
}

export function ConfirmModal({ payload, onConfirm, onReject }: ConfirmModalProps) {
    const { t } = useI18n();
    const [view, setView] = useState<'main' | 'always' | 'reject'>('main');
    const [rejectReason, setRejectReason] = useState('');

    const escapeHtml = (str: string) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    const safeName = escapeHtml(payload.name);
    const safePurpose = escapeHtml(payload.purpose || 'N/A');
    const safeArgs = escapeHtml(JSON.stringify(payload.arguments || {}, null, 2));

    return (
        <div className="mcp-modal-overlay">
            <div className="mcp-modal-card">
                {view === 'main' && (
                    <>
                        <h2>
                            <span className="warn-icon">✋</span> {t('hitl_title')}
                        </h2>

                        <div className="modal-content">
                            <div className="field">
                                <span className="label">{t('label_tool')}</span>
                                <div className="value tool-name">{safeName}</div>
                            </div>

                            <div className="field">
                                <span className="label">{t('label_purpose')}</span>
                                <div className="value">{safePurpose}</div>
                            </div>

                            <div className="field">
                                <span className="label">{t('label_args')}</span>
                                <pre className="value">{safeArgs}</pre>
                            </div>
                        </div>

                        <div className="buttons">
                            <button className="btn-always" onClick={() => setView('always')}>
                                {t('btn_always')}
                            </button>
                            <button className="btn-reject" onClick={() => setView('reject')}>
                                {t('btn_reject')}
                            </button>
                            <button className="btn-approve" onClick={() => onConfirm(false)}>
                                {t('btn_approve')}
                            </button>
                        </div>
                    </>
                )}

                {view === 'always' && (
                    <>
                        <h2>{t('always_title')}</h2>
                        <div className="modal-content">
                            <p>{t('always_desc_1')}</p>
                            <div className="value tool-name" style={{ margin: '10px 0' }}>{safeName}</div>
                            <p>{t('always_desc_2')}</p>
                        </div>
                        <div className="buttons">
                            <button className="btn-secondary" onClick={() => setView('main')}>
                                {t('btn_back')}
                            </button>
                            <button className="btn-approve" onClick={() => onConfirm(true)}>
                                {t('btn_allow_confirm')}
                            </button>
                        </div>
                    </>
                )}

                {view === 'reject' && (
                    <>
                        <h2>{t('btn_reject')}</h2>
                        <div className="modal-content">
                            <input
                                type="text"
                                className="reason-input"
                                placeholder={t('placeholder_reason')}
                                value={rejectReason}
                                onChange={(e) => setRejectReason((e.target as HTMLInputElement).value)}
                                autoFocus
                            />
                        </div>
                        <div className="buttons">
                            <button className="btn-secondary" onClick={() => setView('main')}>
                                {t('btn_back')}
                            </button>
                            <button className="btn-reject" onClick={() => onReject(rejectReason)}>
                                {t('btn_reject_confirm')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * Show confirmation modal in Shadow DOM
 */
export function showConfirmationModal(
    payload: ToolExecutionPayload,
    onConfirm: (always: boolean) => void,
    onReject: (reason: string) => void
) {
    // Create host element
    const host = document.createElement('div');
    host.id = 'mcp-confirm-modal-host';
    host.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 999999;';
    document.body.appendChild(host);

    // Attach Shadow DOM
    const shadow = host.attachShadow({ mode: 'open' });

    // Inject styles
    const styleTag = document.createElement('style');
    styleTag.textContent = styles;
    shadow.appendChild(styleTag);

    const container = document.createElement('div');
    shadow.appendChild(container);

    // Cleanup function
    const cleanup = () => {
        render(null, container);
        host.remove();
    };

    // Render Preact component
    render(
        <ConfirmModal
            payload={payload}
            onConfirm={(always) => {
                cleanup();
                onConfirm(always);
            }}
            onReject={(reason) => {
                cleanup();
                onReject(reason);
            }}
        />,
        container
    );
}
