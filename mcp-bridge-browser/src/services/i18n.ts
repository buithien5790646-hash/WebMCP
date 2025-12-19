/**
 * Internationalization Service
 * Manages language detection and translation resources
 */

export interface I18nResources {
    prompt: string | null;
    train: string | null;
    error: string | null;
}

export type Language = 'en' | 'zh';

class I18nService {
    private _lang: Language;
    private _resources: I18nResources = {
        prompt: null,
        train: null,
        error: null,
    };

    constructor() {
        this._lang = navigator.language.startsWith('zh') ? 'zh' : 'en';
    }

    get lang(): Language {
        return this._lang;
    }

    get resources(): I18nResources {
        return this._resources;
    }

    setResources(resources: Partial<I18nResources>) {
        this._resources = { ...this._resources, ...resources };
    }

    /**
     * Get translated text by key
     */
    t(key: string): string {
        const translations: Record<string, { en: string; zh: string }> = {
            auto_filled: { en: 'Auto-filled initial Prompt', zh: '已自动填充初始 Prompt' },
            captured: { en: 'Captured Call', zh: '捕获调用' },
            exec_success: { en: 'Execution Success', zh: '执行成功' },
            exec_fail: { en: 'Execution Failed', zh: '执行失败' },
            input_not_found: { en: 'Input box not found!', zh: '找不到输入框!' },
            result_written: { en: 'Result written back to input', zh: '结果已回填至输入框' },
            send_success_cleared: { en: 'Send success (Input cleared)', zh: '发送成功 (输入框已清空)' },
            send_btn_missing: { en: 'Send button not found...', zh: '未找到发送按钮...' },
            send_btn_disabled: { en: 'Send button disabled (UI not updated)...', zh: '发送按钮仍被禁用 (UI未更新)...' },
            auto_send_attempt: { en: 'Attempting auto-send', zh: '尝试自动发送' },
            auto_send_timeout: { en: 'Auto-send timed out, please click manually', zh: '自动发送超时,请手动点击发送' },
            config_updated: { en: 'Selectors config updated', zh: '选择器配置已更新' },
            waiting_tools: { en: 'Waiting for tools...', zh: '等待工具执行...' },
            hitl_intercept: { en: 'Intercepted for approval', zh: '拦截等待审批' },
            hitl_rejected: { en: 'User rejected execution', zh: '用户拒绝执行' },
            hitl_title: { en: 'Approval Required', zh: '请求执行工具' },
            label_tool: { en: 'Tool Name', zh: '工具名称' },
            label_purpose: { en: 'Purpose', zh: '操作意图' },
            label_args: { en: 'Arguments', zh: '调用参数' },
            placeholder_reason: { en: 'Reason for rejection (Optional)...', zh: '拒绝理由 (可选)...' },
            btn_always: { en: '⚡ Always Allow', zh: '⚡ 永久允许' },
            btn_back: { en: 'Back', zh: '返回' },
            btn_reject: { en: 'Reject', zh: '拒绝' },
            btn_reject_confirm: { en: 'Confirm Rejection', zh: '确认拒绝' },
            btn_approve: { en: 'Approve', zh: '允许' },
            btn_allow_confirm: { en: 'Confirm Allow', zh: '确认永久允许' },
            always_title: { en: 'Remove Protection?', zh: '移除保护?' },
            always_desc_1: { en: 'You are about to permanently allow', zh: '您即将把以下工具移出保护名单:' },
            always_desc_2: { en: 'Future calls will execute automatically without approval.', zh: '今后 AI 调用此工具将不再经过人工审批。' },
        };

        const entry = translations[key];
        if (!entry) return key;
        return entry[this._lang] || entry.en;
    }
}

export const i18n = new I18nService();
