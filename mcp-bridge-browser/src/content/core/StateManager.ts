import { ConfigState, ExtensionMessage } from '../../types';
import { StorageService } from '../../core/storage';
import { Messenger } from '../../core/messenger';
import { i18n, t } from '../../core/i18n';
import { globalLoggerRef } from '../../components/Logger';

export interface SiteSelectors {
  messageBlocks: string;
  codeBlocks: string;
  inputArea: string;
  sendButton: string;
  stopButton: string;
}

export const DEFAULT_SELECTORS: Record<string, SiteSelectors> = {};

export class StateManager {
  static CONFIG: ConfigState = {
    pollInterval: 1000,
    autoSend: true,
    autoPromptEnabled: false,
  };

  static isClientConnected = false;
  static currentWorkspaceId = "global";

  static userRules = "";
  static allowedTools = new Set<string>();

  static activeSelectors = DEFAULT_SELECTORS;
  static DOM: SiteSelectors | null = null;
  static currentPlatform: string | null = null;

  static async initialize() {
    const host = location.host;
    this.currentPlatform = host.includes("deepseek") ? "deepseek"
      : host.includes("gemini") ? "gemini"
        : host.includes("aistudio") ? "aistudio"
          : (host.includes("chatgpt") || host.includes("openai")) ? "chatgpt"
            : null;

    await this.loadConfig();

    StorageService.onChange((changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
      this.handleStorageChange(changes, namespace);
    });

    Messenger.onMessage((req: ExtensionMessage, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: any) => void) => {
      this.handleMessage(req);
    });
  }

  static async loadConfig() {
    const sync = await StorageService.getSync(["autoSend", "autoPromptEnabled", "customSelectors", "user_rules"]);
    this.CONFIG.autoSend = sync.autoSend ?? true;
    this.CONFIG.autoPromptEnabled = sync.autoPromptEnabled ?? false;
    if (sync.user_rules) { this.userRules = sync.user_rules; }

    const local = await StorageService.getLocal(["defaultSelectors"]);
    const defaults = local.defaultSelectors || DEFAULT_SELECTORS;
    const custom = sync.customSelectors || {};

    this.activeSelectors = { ...defaults };
    for (const platform of Object.keys(custom)) {
      this.activeSelectors[platform] = { ...defaults[platform], ...custom[platform] };
    }
    this.updateDOMConfig();
  }

  private static updateDOMConfig() {
    if (this.currentPlatform && this.activeSelectors && this.activeSelectors[this.currentPlatform]) {
      this.DOM = this.activeSelectors[this.currentPlatform];
    }
  }

  private static handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) {
    if (namespace === "sync") {
      if (changes.autoSend) { this.CONFIG.autoSend = changes.autoSend.newValue; }
      if (changes.autoPromptEnabled) { this.CONFIG.autoPromptEnabled = changes.autoPromptEnabled.newValue; }
      if (changes.user_rules) { this.userRules = changes.user_rules.newValue; }
      if (changes.customSelectors) {
        StorageService.getLocal(["defaultSelectors"]).then((local: any) => {
          const defaults = local.defaultSelectors || DEFAULT_SELECTORS;
          const custom = changes.customSelectors.newValue || {};
          this.activeSelectors = { ...defaults };
          for (const platform of Object.keys(custom)) {
            this.activeSelectors[platform] = { ...defaults[platform], ...custom[platform] };
          }
          this.updateDOMConfig();
          globalLoggerRef?.log(t("config_updated"), "action");
        });
      }
    }
    if (namespace === "local") {
      if (changes[`allowed_tools_${this.currentWorkspaceId}`]) {
        this.allowedTools = new Set(changes[`allowed_tools_${this.currentWorkspaceId}`].newValue || []);
        globalLoggerRef?.log(`Allowed tools updated (Workspace: ${this.currentWorkspaceId})`, "action");
      }
    }
  }

  private static handleMessage(req: ExtensionMessage) {
    if (req.type === "TOGGLE_LOG") {
      globalLoggerRef?.toggle(req.show);
      globalLoggerRef?.log("Logger Visible: " + req.show, "info");
    }
    if (req.type === "STATUS_UPDATE") {
      const wasConnected = this.isClientConnected;
      this.isClientConnected = req.connected;
      if (req.workspaceId) {
        this.currentWorkspaceId = req.workspaceId;
      }
      if (this.isClientConnected !== wasConnected) {
        globalLoggerRef?.log(`[MCP] Connection Status: ${this.isClientConnected ? "Connected" : "Disconnected"}`, "info");
        if (this.isClientConnected) {
          StorageService.getLocal([`allowed_tools_${this.currentWorkspaceId}`]).then((localItems: any) => {
            this.allowedTools = new Set(localItems[`allowed_tools_${this.currentWorkspaceId}`] || []);
          });

          const promptKey = i18n.lang === "zh" ? "prompt_zh" : "prompt_en";
          const trainKey = i18n.lang === "zh" ? "train_zh" : "train_en";
          const errorKey = i18n.lang === "zh" ? "error_zh" : "error_en";
          const initKey = i18n.lang === "zh" ? "init_zh" : "init_en";

          StorageService.getLocal([promptKey as any, trainKey as any, errorKey as any, initKey as any]).then((items: any) => {
            i18n.setResources({
              prompt: items[promptKey],
              train: items[trainKey],
              error: items[errorKey],
              init: items[initKey]
            });
          });
        }
      }
    }
  }
}
