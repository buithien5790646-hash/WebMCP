import { StateManager, SiteSelectors } from './StateManager';
import { globalLoggerRef } from '../../components/Logger';
import { t } from '../../core/i18n';

export abstract class PlatformAdapter {
  protected get DOM(): SiteSelectors | null {
    return StateManager.DOM;
  }

  abstract getMessageBlocks(): NodeListOf<Element>;
  abstract getCodeBlocks(messageBlock: Element): NodeListOf<Element>;
  abstract isGenerating(): boolean;
  abstract writeToInput(text: string): void;
  abstract triggerSend(): void;

  protected internalWriteToInputBox(text: string, inputSelector: string) {
    const inputEl = document.querySelector(inputSelector) as HTMLElement | HTMLInputElement | HTMLTextAreaElement;
    if (!inputEl) {
      globalLoggerRef?.log(t("input_not_found"), "error");
      return;
    }

    let cur = inputEl.innerText || (inputEl as any).value || "";
    cur = cur.replace(/\r\n/g, "\n").replace(/\n+/g, "\n").trim();
    const sep = cur ? "\n\n" : "";
    const final = cur + sep + text;

    inputEl.focus();
    let success = false;
    try {
      document.execCommand("selectAll", false);
      success = document.execCommand("insertText", false, final);
    } catch {
    }

    if (!success) {
      if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
        (inputEl as HTMLInputElement).value = final;
      } else {
        inputEl.innerText = final;
      }
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    }
    globalLoggerRef?.log(t("result_written"), "action");
  }

  protected internalTriggerAutoSend(inputSelector: string, sendSelector: string) {
    let retryCount = 0;
    const maxRetries = 5;

    const trySend = () => {
      const btn = document.querySelector(sendSelector) as HTMLButtonElement;
      const inputEl = document.querySelector(inputSelector) as HTMLElement;
      if (inputEl) { inputEl.focus(); }

      const currentVal = inputEl
        ? (inputEl as any).value || inputEl.innerText || ""
        : "";

      if (currentVal.trim().length === 0) {
        globalLoggerRef?.log(t("send_success_cleared"), "success");
        return;
      }

      if (inputEl) {
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (btn && !btn.disabled) {
        btn.focus();
        btn.click();
        globalLoggerRef?.log(`${t("auto_send_attempt")} (${retryCount + 1})`, "action");
      } else if (!btn) {
        globalLoggerRef?.log(t("send_btn_missing"), "warn");
      } else {
        globalLoggerRef?.log(t("send_btn_disabled"), "warn");
      }

      retryCount++;
      if (retryCount < maxRetries) {
        setTimeout(trySend, 2000);
      } else {
        globalLoggerRef?.log(t("auto_send_timeout"), "error");
        chrome.runtime.sendMessage({
          type: "SHOW_NOTIFICATION",
          title: "Auto-Send Failed",
          message: "Could not click send button.",
        });
      }
    };
    setTimeout(trySend, 1000);
  }
}

export class DefaultPlatformAdapter extends PlatformAdapter {
  getMessageBlocks(): NodeListOf<Element> {
    return this.DOM ? document.querySelectorAll(this.DOM.messageBlocks) : document.querySelectorAll('.non-existent');
  }

  getCodeBlocks(messageBlock: Element): NodeListOf<Element> {
    return this.DOM ? messageBlock.querySelectorAll(this.DOM.codeBlocks) : document.querySelectorAll('.non-existent');
  }

  isGenerating(): boolean {
    if (!this.DOM || !this.DOM.stopButton) {return false;}
    return document.querySelector(this.DOM.stopButton) !== null;
  }

  writeToInput(text: string): void {
    if (this.DOM) {
      this.internalWriteToInputBox(text, this.DOM.inputArea);
    }
  }

  triggerSend(): void {
    if (this.DOM && StateManager.CONFIG.autoSend) {
      this.internalTriggerAutoSend(this.DOM.inputArea, this.DOM.sendButton);
    }
  }
}
