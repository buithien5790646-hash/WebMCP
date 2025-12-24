import { logger as Logger } from "./LoggerService";
import { browserService } from "./BrowserService";

export class ErrorHandlerService {
  /**
   * Report an error with optional user notification
   */
  static report(error: any, context: string, showNotification = false) {
    const message = error instanceof Error ? error.message : String(error);
    const fullMessage = `[${context}] ${message}`;

    // 1. Log to unified logger
    Logger.log(fullMessage, "error");

    // 2. Log to console for dev debugging
    console.error(`[WebMCP Error Handled] ${fullMessage}`, error);

    // 3. Optional browser notification (only if supported in current context)
    if (showNotification && typeof chrome !== "undefined" && chrome.notifications) {
      browserService.createNotification({
        type: "basic",
        iconUrl: browserService.getURL("icons/icon128.png"),
        title: "WebMCP Error",
        message: message,
      });
    }
  }

  /**
   * Wrap an async function with error handling
   */
  static wrap<T>(fn: (...args: any[]) => Promise<T>, context: string) {
    return async (...args: any[]): Promise<T | undefined> => {
      try {
        return await fn(...args);
      } catch (err) {
        this.report(err, context, true);
        return undefined;
      }
    };
  }
}

export const ErrorHandler = ErrorHandlerService;
