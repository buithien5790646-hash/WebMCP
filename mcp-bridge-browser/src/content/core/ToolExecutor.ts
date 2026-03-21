import { ParsedToolCall } from './ToolParser';
import { StateManager } from './StateManager';
import { globalLoggerRef } from '../../components/Logger';
import { i18n, t } from '../../core/i18n';
import { Messenger } from '../../core/messenger';
import { renderInShadow } from '../../components/render';
import { HITLModal } from '../../components/HITLModal';

/**
 * 工具执行器类
 * 负责接收解析后的工具调用请求，进行安全拦截（HITL 审批），并将请求转发给后台脚本执行，
 * 最终将结果格式化并写入缓冲区。
 */
export class ToolExecutor {
  /** 当前正在执行中的请求 ID 集合 */
  public activeExecutions = new Set<string>();
  /** 结果缓冲区：存放各个请求 ID 对应的格式化 JSON 结果文本 */
  private resultBuffer = new Map<string, string>();
  /** 拦截审批队列：存放需要用户人工确认的请求 */
  private confirmationQueue: ParsedToolCall[] = [];
  /** 审批弹窗是否已打开的标志位，防止多个弹窗重叠 */
  private isPopupOpen = false;
  /** 记录总计调用工具的次数，用于定期插入系统复训提示 */
  private toolCallCount = 0;

  constructor(private onExecutionComplete: () => void) { }

  /**
   * 接收并处理一个工具调用请求
   * @param payload 解析后的工具调用载荷
   */
  public executeTool(payload: ParsedToolCall) {
    this.activeExecutions.add(payload.request_id);

    // 拦截处理虚拟工具 1：系统初始化指令
    // 这个指令实际上不发给网关，而是直接返回设定的主提示词给 AI 模型
    if (payload.name === "webmcp_init") {
      let finalPrompt = i18n.resources.prompt || "";
      if (StateManager.userRules) { finalPrompt += `\n\n=== User Rules ===\n${StateManager.userRules}`; }

      globalLoggerRef?.log("Initializing WebMCP via /webmcp command", "action");

      // 将结果写入缓冲区，移除执行状态并通知完成
      this.resultBuffer.set(payload.request_id, finalPrompt);
      this.activeExecutions.delete(payload.request_id);
      this.onExecutionComplete();
      return;
    }

    // 拦截处理虚拟工具 2：任务完成通知
    // 这个指令用于让 AI 能够主动触发浏览器的系统通知
    if (payload.name === "task_completion_notification") {
      this.finishVirtualTool(payload);
      this.onExecutionComplete();
      return;
    }

    // HITL (Human-in-the-Loop) 安全机制检查：
    // 如果工具不在允许白名单中，加入审批队列并唤起人工审批弹窗
    if (!StateManager.allowedTools.has(payload.name)) {
      globalLoggerRef?.log(`${t("hitl_intercept")}: ${payload.name}`, "warn");
      this.confirmationQueue.push(payload);
      this.processConfirmationQueue();
      return;
    }

    // 如果工具在白名单内，直接执行
    this.performExecution(payload);
  }

  /**
   * 真正执行工具调用（通过后台脚本发送给 VS Code Gateway）
   * @param payload 工具调用载荷
   */
  private performExecution(payload: ParsedToolCall) {
    // 发送跨脚本消息让 background 代为请求网关
    Messenger.executeTool({ type: 'EXECUTE_TOOL', payload: payload as any }).then((response) => {
      this.activeExecutions.delete(payload.request_id);
      let outputContent = "";

      // 处理执行成功的结果
      if (response && response.success) {
        globalLoggerRef?.log(`${t("exec_success")}: ${payload.name}`, "success");
        let finalData = response.data;

        // 对 list_tools 的特殊处理：向工具列表中注入客户端内置的虚拟工具定义
        if (payload.name === "list_tools") {
          try {
            const groups = JSON.parse(finalData);

            // 1. 注入客户端的虚拟工具 (Client Tools)
            let clientGroup = groups.find((g: any) => g.server === "client");
            if (!clientGroup) {
              clientGroup = { server: "client", tools: [], hidden_tools: [] };
              groups.push(clientGroup);
            }
            clientGroup.tools.push({
              name: "task_completion_notification",
              description:
                "Notify the user that a long-running task or a series of complex operations is complete. Use this when you need the user's attention to review your work or provide new instructions. Calling this will trigger a system notification on the user's device.",
              inputSchema: {
                type: "object",
                properties: { message: { type: "string" } },
                required: ["message"],
              },
            });

            // 2. 更新最终输出的数据
            finalData = JSON.stringify(groups, null, 2);
          } catch (e) {
            console.error("Tool list processing error", e);
          }
        }
        outputContent = finalData;
      } else {
        // 处理执行失败的结果
        globalLoggerRef?.log(`${t("exec_fail")}: ${response.error}`, "error");
        outputContent = `❌ Error: ${response.error}`;
      }

      // 将执行结果序列化保存到缓冲区
      this.saveToBuffer(payload.request_id, outputContent, !(response && response.success));
      // 通知批处理器检查是否所有并发任务都已完成
      this.onExecutionComplete();
    });
  }

  /**
   * 完成虚拟工具：任务完成通知
   * 触发浏览器系统通知，并清空该请求的结果缓存（不返回实际文本给 AI）
   */
  private finishVirtualTool(payload: ParsedToolCall) {
    const msg = payload.arguments?.message || "Task Completed";
    globalLoggerRef?.log(`🔔 Notification: ${msg}`, "action");
    Messenger.showNotification("WebMCP Task Finished", msg);
    this.activeExecutions.delete(payload.request_id);
    this.resultBuffer.set(payload.request_id, "");
  }

  /**
   * 将执行结果格式化为 Markdown JSON 代码块，并存入结果缓冲区
   *
   * @param requestId 请求 ID
   * @param content 结果文本或错误信息
   * @param isError 是否发生错误
   */
  private saveToBuffer(requestId: string, content: string, isError = false) {
    const responseJson: any = {
      mcp_action: "result",
      request_id: requestId,
      status: isError ? "error" : "success",
    };

    // 区分成功输出和错误信息字段
    if (isError) {
      responseJson.error = content;
    } else {
      responseJson.output = content;
    }

    // 定期注入复训提示词 (每执行 5 个工具调用发送一次)
    // 防止 AI 在长对话中忘记必须遵循固定 JSON 格式进行调用的规则
    this.toolCallCount++;
    if (this.toolCallCount > 0 && this.toolCallCount % 5 === 0) {
      let note = i18n.resources.train || `[System] Reminder: Tool calls MUST use this JSON format: {"mcp_action":"call", "name": "tool_name", "arguments": {...}}.`;
      if (StateManager.userRules) { note += `\n(User Rules: ${StateManager.userRules})`; }
      responseJson.system_note = note;
    }

    // 组装为完整的 Markdown 代码块格式
    const jsonString = `\`\`\`json\n${JSON.stringify(
      responseJson,
      null,
      2
    )}\n\`\`\``;
    this.resultBuffer.set(requestId, jsonString);
  }

  /**
   * 处理需要人工审批的拦截队列
   * 按顺序弹窗提示用户确认是否允许执行工具
   */
  private processConfirmationQueue() {
    // 如果已经有弹窗打开，或队列为空，则暂不处理
    if (this.isPopupOpen || this.confirmationQueue.length === 0) { return; }

    const payload = this.confirmationQueue[0];
    this.isPopupOpen = true;

    // 发送系统通知提示用户需要审批
    Messenger.showNotification("Approval Required", `Tool: ${payload.name}`);

    // 在 Shadow DOM 中渲染审批弹窗界面
    const unmount = renderInShadow(HITLModal, {
      payload,
      // 用户点击确认执行
      onConfirm: (isAlways: boolean) => {
        this.confirmationQueue.shift();
        this.isPopupOpen = false;
        unmount(); // 卸载弹窗组件

        // 重新聚焦输入框，防止用户丢失焦点
        const inputEl = StateManager.DOM ? document.querySelector(StateManager.DOM.inputArea) as HTMLElement : null;
        if (inputEl) { inputEl.focus(); }

        // 如果用户勾选了“永久允许”
        if (isAlways) {
          StateManager.allowedTools.add(payload.name);
          const key = `allowed_tools_${StateManager.currentWorkspaceId}`;
          // 持久化保存到 Storage
          chrome.storage.local.set({ [key]: Array.from(StateManager.allowedTools) });
          globalLoggerRef?.log(`⚡ Tool '${payload.name}' set to Always Allow in this workspace`, "action");
        }

        // 继续执行请求
        this.performExecution(payload);
        // 处理队列中下一个请求
        this.processConfirmationQueue();
      },
      // 用户点击拒绝执行
      onReject: (reason: string) => {
        this.confirmationQueue.shift();
        this.isPopupOpen = false;
        unmount();

        this.activeExecutions.delete(payload.request_id);
        const inputEl = StateManager.DOM ? document.querySelector(StateManager.DOM.inputArea) as HTMLElement : null;
        if (inputEl) { inputEl.focus(); }

        globalLoggerRef?.log(`${t("hitl_rejected")}: ${payload.name}`, "error");

        // 生成拒绝的错误返回结果给 AI，包含用户填写的拒绝理由
        this.saveToBuffer(payload.request_id, `User rejected execution. Reason: ${reason || "No reason provided."}`, true);

        // 触发完成回调，可能会立即将此拒绝结果回填给 AI
        this.onExecutionComplete();
        this.processConfirmationQueue();
      },
      // 用户点击背景或右上角关闭弹窗
      onClose: () => {
        this.isPopupOpen = false;
        unmount();
      }
    }, 'webmcp-hitl-modal-container');
  }

  /**
   * 获取当前所有的结果缓存区内容
   */
  public getResultBuffer() {
    return this.resultBuffer;
  }
}
