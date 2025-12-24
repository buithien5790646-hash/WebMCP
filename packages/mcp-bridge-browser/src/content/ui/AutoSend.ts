import { i18n } from "@/services/i18n";
const { t } = i18n;
import { logger as Logger } from "@/services/LoggerService";
import { browserService } from "@/services/BrowserService";

/**
 * Auto Send Module
 * Handles automatic sending of messages
 */

let autoSendTimer: NodeJS.Timeout | null = null;
let isRetryActive = false;

/**
 * Cancel any pending auto-send
 */
export function cancelAutoSend() {
  if (autoSendTimer) {
    clearTimeout(autoSendTimer);
    autoSendTimer = null;
  }
  if (isRetryActive) {
    isRetryActive = false;
    Logger.log("🚫 Auto-send cancelled/reset (New activity detected)", "warn");
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

  if (isRetryActive) {
    Logger.log("⏳ Auto-send already in progress, skipping duplicate trigger", "info");
    return;
  }

  isRetryActive = true;
  let retryCount = 0;
  const maxRetries = 15; // Increased retries for background tasks

  const trySend = () => {
    // Re-query elements as the page might have updated
    const btn = document.querySelector(selectors.sendButton) as HTMLButtonElement;
    const inputEl = document.querySelector(selectors.inputArea) as HTMLElement;
    
    // Check for stop button (loading state)
    // We assume the adapter's parent or a common pattern might have a stop button
    // Let's try to find if there's any button that indicates "responding"
    const stopBtn = document.querySelector('button[data-testid="stop-button"], button.stop-button, [aria-label*="Stop"], [aria-label*="停止"]') as HTMLButtonElement;

    if (stopBtn) {
      Logger.log("⏳ Page is still in 'responding' state (Stop button visible), waiting...", "info");
      // Background Wakeup: Even if stop button is there, we might want to poke the input 
      // to make sure the SPA hasn't frozen its state machine.
      if (document.hidden && inputEl) {
        inputEl.dispatchEvent(new Event("mousemove", { bubbles: true }));
      }
    } else if (!btn || btn.disabled) {
      // If button is missing or disabled, it might be due to background throttling or SPA state.
      // We try to trigger a "synthetic" interaction to wake up the page.
      if (inputEl) {
        inputEl.focus();
        // Dispatching multiple events to wake up React/Vue/Svelte listeners
        inputEl.dispatchEvent(new Event("focus", { bubbles: true }));
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        
        // Force a sequence of keys that usually triggers UI updates without changing content
        inputEl.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Shift" }));
        inputEl.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Shift" }));
        
        // Some SPAs check for recent "user" activity before enabling buttons
        const clickEvent = new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window });
        inputEl.dispatchEvent(clickEvent);
      }
    }

    // Check if input has content
    const currentVal = inputEl ? (inputEl as any).value || inputEl.innerText || "" : "";

    if (currentVal.trim().length === 0) {
      Logger.log(t("send_success_cleared"), "success");
      isRetryActive = false;
      return;
    }

    // Trigger input events to ensure UI is updated
    if (inputEl) {
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // Try to click send button
    if (btn && !btn.disabled) {
      btn.focus();
      btn.click();
      Logger.log(`${t("auto_send_attempt")} (${retryCount + 1})`, "action");
    } else if (!btn) {
      Logger.log(t("send_btn_missing"), "warn");
    } else {
      Logger.log(t("send_btn_disabled"), "warn");
    }

    // Retry logic
    retryCount++;
    if (retryCount < maxRetries) {
      autoSendTimer = setTimeout(trySend, 2000);
    } else {
      isRetryActive = false;
      Logger.log(t("auto_send_timeout"), "error");
      browserService.sendMessage({
        type: "SHOW_NOTIFICATION",
        title: "Auto-Send Failed",
        message: "Could not click send button.",
      });
    }
  };

  // Start auto-send after 1 second delay
  autoSendTimer = setTimeout(trySend, 1000);
}
