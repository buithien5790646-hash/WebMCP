import { StateManager } from './StateManager';
import { PlatformAdapter } from './PlatformAdapter';
import { globalLoggerRef } from '../../components/Logger';
import { i18n, t } from '../../core/i18n';

export interface RawBlockEvent {
  element: HTMLElement;
  textContent: string;
}

export class MessageObserver {
  private adapter: PlatformAdapter;
  private isCheckScheduled = false;
  private onRawBlockCb: ((event: RawBlockEvent) => void) | null = null;
  private onBatchReadyCb: ((actionableIds: string[]) => void) | null = null;
  private currentTurnIds: string[] = [];

  constructor(adapter: PlatformAdapter) {
    this.adapter = adapter;
  }

  public onRawBlock(callback: (event: RawBlockEvent) => void) {
    this.onRawBlockCb = callback;
  }

  public onBatchReady(callback: (actionableIds: string[]) => void) {
    this.onBatchReadyCb = callback;
  }

  public start() {
    const observer = new MutationObserver(() => {
      if (!StateManager.isClientConnected) { return; }
      if (!this.isCheckScheduled) {
        this.isCheckScheduled = true;
        setTimeout(() => this.runMainLoop(), StateManager.CONFIG.pollInterval);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  public scheduleRun() {
    if (!this.isCheckScheduled) {
      this.isCheckScheduled = true;
      setTimeout(() => this.runMainLoop(), StateManager.CONFIG.pollInterval);
    }
  }

  private runMainLoop() {
    this.isCheckScheduled = false;
    if (!StateManager.DOM || !StateManager.isClientConnected) { return; }

    const messages = this.adapter.getMessageBlocks();

    if (messages.length === 0) {
      this.handleAutoPrompt();
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const codeElements = this.adapter.getCodeBlocks(lastMessage);
    this.currentTurnIds = [];

    codeElements.forEach((codeEl) => {
      const textContent = (codeEl.textContent || "").trim();
      if (!/"mcp_action"\s*:\s*"call"/.test(textContent)) { return; }

      if (this.onRawBlockCb) {
        this.onRawBlockCb({ element: codeEl as HTMLElement, textContent });
      }

      const reqId = (codeEl as HTMLElement).dataset.mcpRequestId;
      if (reqId) {
        this.currentTurnIds.push(reqId);
      }
    });

    if (this.currentTurnIds.length > 0 && this.onBatchReadyCb) {
      this.onBatchReadyCb([...this.currentTurnIds]);
    }
  }

  private handleAutoPrompt() {
    const DOM = StateManager.DOM;
    if (!DOM) {return;}
    const inputEl = document.querySelector(DOM.inputArea) as HTMLElement;

    if (inputEl && StateManager.CONFIG.autoPromptEnabled && (inputEl.textContent || "").trim() === "") {
      if (i18n.resources.prompt) {
        let finalPrompt = i18n.resources.prompt;
        if (StateManager.userRules) { finalPrompt += `\n\n=== User Rules ===\n${StateManager.userRules}`; }
        inputEl.innerText = finalPrompt;
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        globalLoggerRef?.log(t("auto_filled"), "action");
      }
    }
  }
}
