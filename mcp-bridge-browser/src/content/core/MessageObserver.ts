import { StateManager } from './StateManager';
import { PlatformAdapter } from './PlatformAdapter';
import { globalLoggerRef } from '../../components/Logger';
import { i18n, t } from '../../core/i18n';

/**
 * 原始代码块事件对象，传递给解析器
 */
export interface RawBlockEvent {
  element: HTMLElement; // 包含代码块的 DOM 元素
  textContent: string;  // 代码块中的纯文本内容
}

/**
 * 消息观察者类
 * 负责使用 MutationObserver 监听网页 DOM 变化，提取 AI 输出的代码块，
 * 并将包含潜在工具调用的代码块分发给解析器和批处理模块。
 */
export class MessageObserver {
  private adapter: PlatformAdapter;
  // 节流标记，防止 MutationObserver 频繁触发导致性能问题
  private isCheckScheduled = false;

  // 回调函数：当发现疑似工具调用的代码块时触发
  private onRawBlockCb: ((event: RawBlockEvent) => void) | null = null;
  // 回调函数：当一轮消息生成周期（或批次）准备就绪时触发
  private onBatchReadyCb: ((actionableIds: string[]) => void) | null = null;

  // 记录当前对话轮次中发现的所有请求 ID
  private currentTurnIds: string[] = [];

  constructor(adapter: PlatformAdapter) {
    this.adapter = adapter;
  }

  /**
   * 注册处理单个代码块的回调
   * @param callback 接收 RawBlockEvent 的回调函数
   */
  public onRawBlock(callback: (event: RawBlockEvent) => void) {
    this.onRawBlockCb = callback;
  }

  /**
   * 注册处理批次结果的回调
   * @param callback 接收当前轮次所有请求 ID 数组的回调函数
   */
  public onBatchReady(callback: (actionableIds: string[]) => void) {
    this.onBatchReadyCb = callback;
  }

  /**
   * 启动 DOM 监听
   */
  public start() {
    const observer = new MutationObserver(() => {
      // 如果没有连接到本地网关，则忽略 DOM 变化
      if (!StateManager.isClientConnected) { return; }

      // 使用 setTimeout 进行节流，依据配置的轮询间隔
      if (!this.isCheckScheduled) {
        this.isCheckScheduled = true;
        setTimeout(() => this.runMainLoop(), StateManager.CONFIG.pollInterval);
      }
    });

    // 监听整个 body 的子节点、子树及文本内容的改变
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  /**
   * 手动触发一次主循环检查（用于重试等场景）
   */
  public scheduleRun() {
    if (!this.isCheckScheduled) {
      this.isCheckScheduled = true;
      setTimeout(() => this.runMainLoop(), StateManager.CONFIG.pollInterval);
    }
  }

  /**
   * 主循环逻辑：查找页面上最新的消息和代码块
   */
  private runMainLoop() {
    this.isCheckScheduled = false;
    // 确保 DOM 配置已加载且客户端处于连接状态
    if (!StateManager.DOM || !StateManager.isClientConnected) { return; }

    // 通过适配器获取当前页面所有的消息气泡块
    const messages = this.adapter.getMessageBlocks();

    // 如果没有任何消息，可能是刚打开的新对话，尝试自动填充初始 Prompt
    if (messages.length === 0) {
      this.handleAutoPrompt();
      return;
    }

    // 只关注最后一条消息（通常是 AI 当前正在生成的回复）
    const lastMessage = messages[messages.length - 1];
    const codeElements = this.adapter.getCodeBlocks(lastMessage);
    this.currentTurnIds = [];

    // 遍历最新消息中的所有代码块
    codeElements.forEach((codeEl) => {
      const textContent = (codeEl.textContent || "").trim();

      // 快速前置检查：如果文本中不包含 "mcp_action":"call" 的特征字符串，直接跳过
      if (!/"mcp_action"\s*:\s*"call"/.test(textContent)) { return; }

      // 触发单个代码块的处理回调 (通常是传递给 ToolParser 去解析 JSON)
      if (this.onRawBlockCb) {
        this.onRawBlockCb({ element: codeEl as HTMLElement, textContent });
      }

      // 如果解析器成功分配了 request_id，则收集到当前轮次的 ID 列表中
      const reqId = (codeEl as HTMLElement).dataset.mcpRequestId;
      if (reqId) {
        this.currentTurnIds.push(reqId);
      }
    });

    // 如果当前轮次发现了工具调用请求，通知批处理器
    if (this.currentTurnIds.length > 0 && this.onBatchReadyCb) {
      this.onBatchReadyCb([...this.currentTurnIds]);
    }
  }

  /**
   * 处理自动发送初始提示词的逻辑
   * 在配置允许且输入框为空的情况下，自动注入系统初始 Prompt
   */
  private handleAutoPrompt() {
    const DOM = StateManager.DOM;
    if (!DOM) {return;}
    const inputEl = document.querySelector(DOM.inputArea) as HTMLElement;

    // 检查是否开启了自动提示，且输入框确实为空
    if (inputEl && StateManager.CONFIG.autoPromptEnabled && (inputEl.textContent || "").trim() === "") {
      if (i18n.resources.prompt) {
        let finalPrompt = i18n.resources.prompt;
        // 如果用户配置了自定义规则，追加到提示词末尾
        if (StateManager.userRules) { finalPrompt += `\n\n=== User Rules ===\n${StateManager.userRules}`; }

        inputEl.innerText = finalPrompt;
        // 触发输入事件，让网页前端框架感知到内容的填充
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        globalLoggerRef?.log(t("auto_filled"), "action");
      }
    }
  }
}
