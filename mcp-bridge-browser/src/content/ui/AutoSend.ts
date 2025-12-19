import { i18n } from '@/services/i18n';
const { t } = i18n;
import { logger as Logger } from '@/services/LoggerService';
import { browserService } from '@/services/BrowserService';

/**
 * Auto Send Module
 * Handles automatic sending of messages
 */

let autoSendTimer: NodeJS.Timeout | null = null;

/**
 * Cancel any pending auto-send
 */
export function cancelAutoSend() {
    if (autoSendTimer) {
        clearTimeout(autoSendTimer);
        autoSendTimer = null;
        Logger.log('🚫 Auto-send cancelled (New activity detected)', 'warn');
    }
}

/**
 * Trigger auto-send with retry logic
 */
export function triggerAutoSend(
    config: { autoSend: boolean },
    selectors: { inputArea: string; sendButton: string }
) {
    if (!config.autoSend) return;

    // Cancel any existing timer
    if (autoSendTimer) {
        clearTimeout(autoSendTimer);
        autoSendTimer = null;
    }

    let retryCount = 0;
    const maxRetries = 5;

    const trySend = () => {
        const btn = document.querySelector(selectors.sendButton) as HTMLButtonElement;
        const inputEl = document.querySelector(selectors.inputArea) as HTMLElement;

        // Focus input
        if (inputEl) inputEl.focus();

        // Check if input has content
        const currentVal = inputEl
            ? (inputEl as any).value || inputEl.innerText || ''
            : '';

        if (currentVal.trim().length === 0) {
            Logger.log(t('send_success_cleared'), 'success');
            return;
        }

        // Trigger input events to ensure UI is updated
        if (inputEl) {
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Try to click send button
        if (btn && !btn.disabled) {
            btn.focus();
            btn.click();
            Logger.log(`${t('auto_send_attempt')} (${retryCount + 1})`, 'action');
        } else if (!btn) {
            Logger.log(t('send_btn_missing'), 'warn');
        } else {
            Logger.log(t('send_btn_disabled'), 'warn');
        }

        // Retry logic
        retryCount++;
        if (retryCount < maxRetries) {
            autoSendTimer = setTimeout(trySend, 2000);
        } else {
            Logger.log(t('auto_send_timeout'), 'error');
            browserService.sendMessage({
                type: 'SHOW_NOTIFICATION',
                title: 'Auto-Send Failed',
                message: 'Could not click send button.',
            });
        }
    };

    // Start auto-send after 1 second delay
    autoSendTimer = setTimeout(trySend, 1000);
}
