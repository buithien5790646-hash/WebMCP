import { Logger, t } from '../../modules/utils';

/**
 * Input Operations Module
 * Handles writing to input boxes and triggering events
 */

/**
 * Write text to an input element
 */
export function writeToInputBox(text: string, inputSelector: string) {
    const inputEl = document.querySelector(inputSelector) as HTMLElement | HTMLInputElement | HTMLTextAreaElement;

    if (!inputEl) {
        Logger.log(t('input_not_found'), 'error');
        return;
    }

    // Get current content
    let cur = inputEl.innerText || (inputEl as any).value || '';
    cur = cur.replace(/\r\n/g, '\n').replace(/\n+/g, '\n').trim();

    // Add separator if needed
    const sep = cur ? '\n\n' : '';
    const final = cur + sep + text;

    // Focus the input
    inputEl.focus();

    // Try using execCommand first (works better with some platforms)
    let success = false;
    try {
        document.execCommand('selectAll', false);
        success = document.execCommand('insertText', false, final);
    } catch (e) {
        // execCommand failed, fall through to manual method
    }

    // Fallback: set value/innerText directly
    if (!success) {
        if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
            (inputEl as HTMLInputElement).value = final;
        } else {
            inputEl.innerText = final;
        }
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    Logger.log(t('result_written'), 'action');
}

/**
 * Clear input box content
 */
export function clearInputBox(inputSelector: string) {
    const inputEl = document.querySelector(inputSelector) as HTMLElement | HTMLInputElement | HTMLTextAreaElement;

    if (!inputEl) return;

    if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
        (inputEl as HTMLInputElement).value = '';
    } else {
        inputEl.innerText = '';
    }

    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Focus input element
 */
export function focusInput(inputSelector: string) {
    const inputEl = document.querySelector(inputSelector);
    if (inputEl) {
        (inputEl as HTMLElement).focus();
    }
}
