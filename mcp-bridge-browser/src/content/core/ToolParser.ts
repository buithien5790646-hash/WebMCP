import { RawBlockEvent } from './MessageObserver';
import { globalLoggerRef } from '../../components/Logger';
import { t } from '../../core/i18n';

// Regular expression to match common non-standard whitespace characters, including non-breaking space (\u00a0)
const nonStandardSpaces = /[\u00a0\uFEFF\u200B]/g;
const STABILIZATION_TIMEOUT = 3000;

export interface ParsedToolCall {
  request_id: string;
  name: string;
  arguments: any;
  mcp_action: "call";
}

export class ToolParser {
  private blockStates = new WeakMap<Element, { text: string; time: number; errorNotified: boolean }>();
  public processedRequests = new Set<string>();

  public parseBlock(event: RawBlockEvent, onNewCall: (payload: ParsedToolCall, el: HTMLElement) => void) {
    const { element, textContent } = event;
    const cleanedText = textContent.replace(nonStandardSpaces, ' ');

    try {
      const payload = JSON.parse(cleanedText);
      if (this.blockStates.has(element)) { this.blockStates.delete(element); }

      // Successfully parsed JSON, try to clear old error styles (if they exist)
      if (element.dataset.mcpState === "error") {
        element.style.border = "none";
        delete element.dataset.mcpState;
      }

      if (payload.mcp_action === "call") {
        if (!payload.request_id) {
          if (!element.dataset.mcpRequestId) {
            element.dataset.mcpRequestId = "req_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
          }
          payload.request_id = element.dataset.mcpRequestId;
        }

        const isKnown = this.processedRequests.has(payload.request_id);

        if (!isKnown) {
          this.processedRequests.add(payload.request_id);
          this.markVisualProcessing(element);
          globalLoggerRef?.log(`${t("captured")}: ${payload.name}`, "info");
          onNewCall(payload, element);
        }
      }
    } catch (e: any) {
      // JSON Stabilization Logic
      const now = Date.now();
      let state = this.blockStates.get(element);
      if (!state || state.text !== textContent) {
        this.blockStates.set(element, {
          text: textContent,
          time: now,
          errorNotified: false,
        });
        if (element.dataset.mcpState === "error") {
          element.style.border = "none";
          delete element.dataset.mcpState;
          delete element.dataset.mcpVisual;
        }
      } else {
        if (now - state.time > STABILIZATION_TIMEOUT && !state.errorNotified) {
          globalLoggerRef?.log("JSON Parse Error (Stable): " + e.message, "error");
          this.markVisualError(element);
          chrome.runtime.sendMessage({
            type: "SHOW_NOTIFICATION",
            title: "WebMCP Error",
            message: "Invalid JSON format (Stuck).",
          });
          state.errorNotified = true;
          this.blockStates.set(element, state);
        }
      }
    }
  }

  public markVisualProcessing(element: HTMLElement) {
    if (element.dataset.mcpState === "processing") { return; }
    element.dataset.mcpState = "processing";
    element.dataset.mcpVisual = "true";
    element.style.border = "2px solid #2196F3"; // Blue
    element.style.borderRadius = "4px";
    element.style.transition = "border-color 0.3s ease";
  }

  public markVisualSuccess(element: HTMLElement) {
    if (element.dataset.mcpState === "success") { return; }
    element.dataset.mcpState = "success";
    element.dataset.mcpVisual = "true";
    element.style.border = "2px solid #00E676"; // Green
    element.style.borderRadius = "4px";
  }

  public markVisualError(element: HTMLElement) {
    if (element.dataset.mcpState === "error") { return; }
    element.dataset.mcpState = "error";
    element.dataset.mcpVisual = "true";
    element.style.border = "2px solid #F44336"; // Red
    element.style.borderRadius = "4px";
  }
}
