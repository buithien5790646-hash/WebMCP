import { ConfigState, ExtensionMessage } from '../../types';
import { StorageService } from '../../core/storage';
import { Messenger } from '../../core/messenger';
import { i18n, t } from '../../core/i18n';
import {  LoggerRef  } from '../../components/Logger';

/**
 * 网站 DOM 元素选择器配置接口
 */
export interface SiteSelectors {
  messageBlocks: string; // 消息气泡列表的选择器
  codeBlocks: string;    // 消息内代码块的选择器
  inputArea: string;     // 聊天输入框的选择器
  sendButton: string;    // 发送按钮的选择器
  stopButton: string;    // 停止生成按钮的选择器
}

// 默认的空选择器配置，实际运行时会从 background 中同步网关拉取到的配置
export const DEFAULT_SELECTORS: Record<string, SiteSelectors> = {};

/**
 * 状态管理器类（单例）
 * 负责维护内容脚本（Content Script）运行时的全局状态，处理配置同步与消息通信
 */
export class StateManager {
  // 核心功能配置开关及参数
  static CONFIG: ConfigState = {
    pollInterval: 1000,
    autoSend: true,
    autoPromptEnabled: false,
  };

  // WebMCP 客户端是否已成功连接至本地 VS Code 网关
  static isClientConnected = false;
  // 当前工作区的标识符
  static currentWorkspaceId = "global";

  // 用户自定义规则（提示词附加内容）
  static userRules = "";
  // 当前工作区允许免审执行的工具名称集合
  static allowedTools = new Set<string>();

  // 当前激活的所有网站的选择器配置字典
  static activeSelectors = DEFAULT_SELECTORS;
  // 当前所处网页平台对应的 DOM 选择器
  static DOM: SiteSelectors | null = null;
  // 当前所处网页平台的名称标识（如 chatgpt, gemini, deepseek）
  static currentPlatform: string | null = null;

  /**
   * 初始化状态管理器
   * 识别当前运行的网站平台，加载本地配置，并设置监听器
   */
  static async initialize() {
    const host = location.host;
    // 根据域名判断当前是哪个 AI 平台
    this.currentPlatform = host.includes("deepseek") ? "deepseek"
      : host.includes("gemini") ? "gemini"
        : host.includes("aistudio") ? "aistudio"
          : (host.includes("chatgpt") || host.includes("openai")) ? "chatgpt"
            : null;

    await this.loadConfig();

    // 监听本地存储变化，以便实时热更新配置
    StorageService.onChange((changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
      this.handleStorageChange(changes, namespace);
    });

    // 监听来自 Background/Popup 的消息指令
    Messenger.onMessage((req: ExtensionMessage, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: any) => void) => {
      this.handleMessage(req);
    });
  }

  /**
   * 从 Chrome Storage 加载初始配置和选择器
   */
  static async loadConfig() {
    const sync = await StorageService.getSync(["autoSend", "autoPromptEnabled", "customSelectors", "user_rules"]);
    this.CONFIG.autoSend = sync.autoSend ?? true;
    this.CONFIG.autoPromptEnabled = sync.autoPromptEnabled ?? false;
    if (sync.user_rules) { this.userRules = sync.user_rules; }

    const local = await StorageService.getLocal(["defaultSelectors"]);
    const defaults = local.defaultSelectors || DEFAULT_SELECTORS;
    const custom = sync.customSelectors || {};

    // 合并默认配置与用户自定义选择器配置
    this.activeSelectors = { ...defaults };
    for (const platform of Object.keys(custom)) {
      this.activeSelectors[platform] = { ...defaults[platform], ...custom[platform] };
    }
    this.updateDOMConfig();
  }

  /**
   * 根据当前平台更新对应的 DOM 选择器引用
   */
  private static updateDOMConfig() {
    if (this.currentPlatform && this.activeSelectors && this.activeSelectors[this.currentPlatform]) {
      this.DOM = this.activeSelectors[this.currentPlatform];
    }
  }

  /**
   * 处理 Storage 变化事件
   */
  private static handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) {
    if (namespace === "sync") {
      if (changes.autoSend) { this.CONFIG.autoSend = changes.autoSend.newValue; }
      if (changes.autoPromptEnabled) { this.CONFIG.autoPromptEnabled = changes.autoPromptEnabled.newValue; }
      if (changes.user_rules) { this.userRules = changes.user_rules.newValue; }
      // 如果自定义选择器变化，重新合并并应用
      if (changes.customSelectors) {
        StorageService.getLocal(["defaultSelectors"]).then((local: any) => {
          const defaults = local.defaultSelectors || DEFAULT_SELECTORS;
          const custom = changes.customSelectors.newValue || {};
          this.activeSelectors = { ...defaults };
          for (const platform of Object.keys(custom)) {
            this.activeSelectors[platform] = { ...defaults[platform], ...custom[platform] };
          }
          this.updateDOMConfig();
          LoggerRef.current?.log(t("config_updated"), "action");
        });
      }
    }
    // 监听工作区特定的免审工具列表变更
    if (namespace === "local") {
      if (changes[`allowed_tools_${this.currentWorkspaceId}`]) {
        this.allowedTools = new Set(changes[`allowed_tools_${this.currentWorkspaceId}`].newValue || []);
        LoggerRef.current?.log(`Allowed tools updated (Workspace: ${this.currentWorkspaceId})`, "action");
      }
    }
  }

  /**
   * 处理 Extension 跨脚本消息
   */
  private static handleMessage(req: ExtensionMessage) { 
    // 切换日志悬浮窗的显示状态
    if (req.type === "TOGGLE_LOG") {
      LoggerRef.current?.toggle(req.show);
      LoggerRef.current?.log("Logger Visible: " + req.show, "info");
    }

    // 接收连接状态更新
    if (req.type === "STATUS_UPDATE") {
      const wasConnected = this.isClientConnected;
      this.isClientConnected = req.connected;
      if (req.workspaceId) {
        this.currentWorkspaceId = req.workspaceId;
      }

      // 只有在状态发生翻转时才执行初始化动作
      if (this.isClientConnected !== wasConnected) {
        LoggerRef.current?.log(`[MCP] Connection Status: ${this.isClientConnected ? "Connected" : "Disconnected"}`, "info");

        // 当重新连接时，拉取对应工作区的白名单和最新的提示词资源
        if (this.isClientConnected) {
          StorageService.getLocal([`allowed_tools_${this.currentWorkspaceId}`]).then((localItems: any) => {
            this.allowedTools = new Set(localItems[`allowed_tools_${this.currentWorkspaceId}`] || []);
          });

          // 根据当前界面语言环境获取相应的多语言提示词
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
