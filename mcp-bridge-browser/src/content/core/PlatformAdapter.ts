import { StateManager, SiteSelectors } from './StateManager';
import { globalLoggerRef } from '../../components/Logger';
import { t } from '../../core/i18n';

/**
 * 平台适配器基类
 * 抽象出不同网页 AI 平台（如 ChatGPT, Claude, Gemini）的 DOM 操作差异
 */
export abstract class PlatformAdapter {
  protected get DOM(): SiteSelectors | null {
    return StateManager.DOM;
  }

  /** 获取页面上所有的消息气泡块 */
  abstract getMessageBlocks(): NodeListOf<Element>;
  /** 获取指定消息气泡块内的代码块元素 */
  abstract getCodeBlocks(messageBlock: Element): NodeListOf<Element>;
  /** 判断 AI 模型当前是否正在生成回答 */
  abstract isGenerating(): boolean;
  /** 将文本内容写入到页面的聊天输入框中 */
  abstract writeToInput(text: string): void;
  /** 触发自动发送消息的动作 */
  abstract triggerSend(): void;

  /**
   * 内部通用实现：将文本写入输入框
   * 支持通过 document.execCommand 以及直接修改 value 的降级策略
   *
   * @param text 要写入的文本
   * @param inputSelector 输入框的 DOM 选择器
   */
  protected internalWriteToInputBox(text: string, inputSelector: string) {
    const inputEl = document.querySelector(inputSelector) as HTMLElement | HTMLInputElement | HTMLTextAreaElement;
    if (!inputEl) {
      globalLoggerRef?.log(t("input_not_found"), "error");
      return;
    }

    let cur = inputEl.innerText || (inputEl as any).value || "";
    // 规范化已有的换行符并去除两端空白
    cur = cur.replace(/\r\n/g, "\n").replace(/\n+/g, "\n").trim();
    const sep = cur ? "\n\n" : "";
    const final = cur + sep + text;

    inputEl.focus();
    let success = false;
    try {
      // 使用剪贴板命令方式插入，这可以触发大部分富文本编辑器（如 Prosemirror）的内部状态更新
      document.execCommand("selectAll", false);
      success = document.execCommand("insertText", false, final);
    } catch {
      // 忽略异常
    }

    // 如果 execCommand 失败，则采用直接赋值的降级方案
    if (!success) {
      if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
        (inputEl as HTMLInputElement).value = final;
      } else {
        inputEl.innerText = final;
      }
      // 触发输入事件，让前端框架捕获到值的改变
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    }
    globalLoggerRef?.log(t("result_written"), "action");
  }

  /**
   * 内部通用实现：触发自动点击发送按钮
   * 包含重试逻辑，以应对 React/Vue 等框架异步更新按钮状态导致的禁用期
   *
   * @param inputSelector 输入框的 DOM 选择器
   * @param sendSelector 发送按钮的 DOM 选择器
   */
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

      // 检查输入框是否为空，如果为空说明之前已经成功发送（框架清空了输入框）
      if (currentVal.trim().length === 0) {
        globalLoggerRef?.log(t("send_success_cleared"), "success");
        return;
      }

      // 再次触发事件以确保前端框架更新发送按钮状态
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

      // 轮询重试机制
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
    // 延迟 1 秒后开始第一次尝试，给前端框架留出渲染时间
    setTimeout(trySend, 1000);
  }
}

/**
 * 默认平台适配器
 * 根据全局配置的动态选择器（DOM）来执行针对性的网页操作
 */
export class DefaultPlatformAdapter extends PlatformAdapter {
  getMessageBlocks(): NodeListOf<Element> {
    return this.DOM ? document.querySelectorAll(this.DOM.messageBlocks) : document.querySelectorAll('.non-existent');
  }

  getCodeBlocks(messageBlock: Element): NodeListOf<Element> {
    return this.DOM ? messageBlock.querySelectorAll(this.DOM.codeBlocks) : document.querySelectorAll('.non-existent');
  }

  isGenerating(): boolean {
    // 假设存在停止生成按钮，说明当前正在生成
    if (!this.DOM || !this.DOM.stopButton) { return false; }
    return document.querySelector(this.DOM.stopButton) !== null;
  }

  writeToInput(text: string): void {
    if (this.DOM) {
      this.internalWriteToInputBox(text, this.DOM.inputArea);
    }
  }

  triggerSend(): void {
    // 只有在用户开启了 autoSend 配置时才会执行自动发送
    if (this.DOM && StateManager.CONFIG.autoSend) {
      this.internalTriggerAutoSend(this.DOM.inputArea, this.DOM.sendButton);
    }
  }
}
