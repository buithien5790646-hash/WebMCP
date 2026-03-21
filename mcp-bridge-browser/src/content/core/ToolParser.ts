import { RawBlockEvent } from './MessageObserver';
import { globalLoggerRef } from '../../components/Logger';
import { t } from '../../core/i18n';

// 匹配常见的非标准空白字符，包括不换行空格（\u00a0）、零宽空格等，以便正确解析 JSON
const nonStandardSpaces = /[\u00a0\uFEFF\u200B]/g;
// 等待 JSON 内容稳定的超时时间 (毫秒)，防止 AI 在流式输出过程中触发不必要的解析错误
const STABILIZATION_TIMEOUT = 3000;

/**
 * 解析后的工具调用载荷接口
 */
export interface ParsedToolCall {
  request_id: string;  // 请求唯一标识符
  name: string;        // 工具名称
  arguments: any;      // 调用参数
  mcp_action: "call";  // 固定标识
}

/**
 * 工具解析器类
 * 负责从 DOM 代码块中提取、清理并解析 AI 输出的 JSON 工具调用请求，同时处理界面视觉反馈
 */
export class ToolParser {
  /** 跟踪各个代码块的解析状态和时间，以判断是否卡死或内容不稳定 */
  private blockStates = new WeakMap<Element, { text: string; time: number; errorNotified: boolean }>();
  /** 已成功处理过的请求 ID 集合，防止重复执行 */
  public processedRequests = new Set<string>();

  /**
   * 尝试解析代码块中的文本
   *
   * @param event 原始代码块事件对象，包含 DOM 元素和纯文本内容
   * @param onNewCall 解析成功后的回调函数，触发执行流程
   */
  public parseBlock(event: RawBlockEvent, onNewCall: (payload: ParsedToolCall, el: HTMLElement) => void) {
    const { element, textContent } = event;
    // 清理特殊空白字符，防止 JSON.parse 抛出语法错误
    const cleanedText = textContent.replace(nonStandardSpaces, ' ');

    try {
      const payload = JSON.parse(cleanedText);
      // 若成功解析，则移除其状态记录，因为内容已经稳定
      if (this.blockStates.has(element)) { this.blockStates.delete(element); }

      // 如果之前被标记为错误状态，成功解析后清除错误样式
      if (element.dataset.mcpState === "error") {
        element.style.border = "none";
        delete element.dataset.mcpState;
      }

      // 验证是否是有效的 MCP 工具调用请求
      if (payload.mcp_action === "call") {
        // 如果没有 requestId，为其生成一个并绑定到 DOM 元素上，确保幂等性
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
      // JSON 稳定化逻辑：处理 AI 流式输出时的残缺 JSON
      const now = Date.now();
      let state = this.blockStates.get(element);

      // 如果之前没有记录或者内容还在变化，更新记录时间
      if (!state || state.text !== textContent) {
        this.blockStates.set(element, {
          text: textContent,
          time: now,
          errorNotified: false,
        });
        // 当文本变化时，移除旧的错误样式
        if (element.dataset.mcpState === "error") {
          element.style.border = "none";
          delete element.dataset.mcpState;
          delete element.dataset.mcpVisual;
        }
      } else {
        // 如果内容长时间没有变化且仍无法解析，说明确实出错了（或 AI 生成被中断）
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

  /**
   * 视觉反馈：将代码块标记为处理中（蓝色边框）
   */
  public markVisualProcessing(element: HTMLElement) {
    if (element.dataset.mcpState === "processing") { return; }
    element.dataset.mcpState = "processing";
    element.dataset.mcpVisual = "true";
    element.style.border = "2px solid #2196F3"; // Blue
    element.style.borderRadius = "4px";
    element.style.transition = "border-color 0.3s ease";
  }

  /**
   * 视觉反馈：将代码块标记为执行成功（绿色边框）
   */
  public markVisualSuccess(element: HTMLElement) {
    if (element.dataset.mcpState === "success") { return; }
    element.dataset.mcpState = "success";
    element.dataset.mcpVisual = "true";
    element.style.border = "2px solid #00E676"; // Green
    element.style.borderRadius = "4px";
  }

  /**
   * 视觉反馈：将代码块标记为执行失败或解析错误（红色边框）
   */
  public markVisualError(element: HTMLElement) {
    if (element.dataset.mcpState === "error") { return; }
    element.dataset.mcpState = "error";
    element.dataset.mcpVisual = "true";
    element.style.border = "2px solid #F44336"; // Red
    element.style.borderRadius = "4px";
  }
}
