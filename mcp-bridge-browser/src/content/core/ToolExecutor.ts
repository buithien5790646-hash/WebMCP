import { ParsedToolCall } from './ToolParser';
import { StateManager } from './StateManager';
import { globalLoggerRef } from '../../components/Logger';
import { i18n, t } from '../../core/i18n';
import { Messenger } from '../../core/messenger';
import { renderInShadow } from '../../components/render';
import { HITLModal } from '../../components/HITLModal';

export class ToolExecutor {
  public activeExecutions = new Set<string>();
  private resultBuffer = new Map<string, string>();
  private confirmationQueue: ParsedToolCall[] = [];
  private isPopupOpen = false;
  private toolCallCount = 0;

  constructor(private onExecutionComplete: () => void) { }

  public executeTool(payload: ParsedToolCall) {
    this.activeExecutions.add(payload.request_id);

    // Virtual tool: system initialization
    if (payload.name === "webmcp_init") {
      let finalPrompt = i18n.resources.prompt || "";
      if (StateManager.userRules) { finalPrompt += `\n\n=== User Rules ===\n${StateManager.userRules}`; }

      globalLoggerRef?.log("Initializing WebMCP via /webmcp command", "action");

      this.resultBuffer.set(payload.request_id, finalPrompt);
      this.activeExecutions.delete(payload.request_id);
      this.onExecutionComplete();
      return;
    }

    // Virtual tool: task completion notification
    if (payload.name === "task_completion_notification") {
      this.finishVirtualTool(payload);
      this.onExecutionComplete();
      return;
    }

    if (!StateManager.allowedTools.has(payload.name)) {
      globalLoggerRef?.log(`${t("hitl_intercept")}: ${payload.name}`, "warn");
      this.confirmationQueue.push(payload);
      this.processConfirmationQueue();
      return;
    }

    this.performExecution(payload);
  }

  private performExecution(payload: ParsedToolCall) {
    Messenger.executeTool({ type: 'EXECUTE_TOOL', payload: payload as any }).then((response) => {
      this.activeExecutions.delete(payload.request_id);
      let outputContent = "";
      if (response && response.success) {
        globalLoggerRef?.log(`${t("exec_success")}: ${payload.name}`, "success");
        let finalData = response.data;
        if (payload.name === "list_tools") {
          try {
            const groups = JSON.parse(finalData);

            // 1. Inject Virtual Client Tools
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

            // 2. Update Output
            finalData = JSON.stringify(groups, null, 2);
          } catch (e) {
            console.error("Tool list processing error", e);
          }
        }
        outputContent = finalData;
      } else {
        globalLoggerRef?.log(`${t("exec_fail")}: ${response.error}`, "error");
        outputContent = `❌ Error: ${response.error}`;
      }
      this.saveToBuffer(payload.request_id, outputContent);
      this.onExecutionComplete();
    });
  }

  private finishVirtualTool(payload: ParsedToolCall) {
    const msg = payload.arguments?.message || "Task Completed";
    globalLoggerRef?.log(`🔔 Notification: ${msg}`, "action");
    Messenger.showNotification("WebMCP Task Finished", msg);
    this.activeExecutions.delete(payload.request_id);
    this.resultBuffer.set(payload.request_id, "");
  }

  private saveToBuffer(requestId: string, content: string, isError = false) {
    const responseJson: any = {
      mcp_action: "result",
      request_id: requestId,
      status: isError ? "error" : "success",
    };
    if (isError) {
      responseJson.error = content;
    } else {
      responseJson.output = content;
    }

    this.toolCallCount++;
    if (this.toolCallCount > 0 && this.toolCallCount % 5 === 0) {
      let note = i18n.resources.train || `[System] Reminder: Tool calls MUST use this JSON format: {"mcp_action":"call", "name": "tool_name", "arguments": {...}}.`;
      if (StateManager.userRules) { note += `\n(User Rules: ${StateManager.userRules})`; }
      responseJson.system_note = note;
    }

    const jsonString = `\`\`\`json\n${JSON.stringify(
      responseJson,
      null,
      2
    )}\n\`\`\``;
    this.resultBuffer.set(requestId, jsonString);
  }

  private processConfirmationQueue() {
    if (this.isPopupOpen || this.confirmationQueue.length === 0) { return; }
    const payload = this.confirmationQueue[0];
    this.isPopupOpen = true;

    Messenger.showNotification("Approval Required", `Tool: ${payload.name}`);

    const unmount = renderInShadow(HITLModal, {
      payload,
      onConfirm: (isAlways: boolean) => {
        this.confirmationQueue.shift();
        this.isPopupOpen = false;
        unmount();

        const inputEl = StateManager.DOM ? document.querySelector(StateManager.DOM.inputArea) as HTMLElement : null;
        if (inputEl) { inputEl.focus(); }

        if (isAlways) {
          StateManager.allowedTools.add(payload.name);
          const key = `allowed_tools_${StateManager.currentWorkspaceId}`;
          chrome.storage.local.set({ [key]: Array.from(StateManager.allowedTools) });
          globalLoggerRef?.log(`⚡ Tool '${payload.name}' set to Always Allow in this workspace`, "action");
        }

        this.performExecution(payload);
        this.processConfirmationQueue();
      },
      onReject: (reason: string) => {
        this.confirmationQueue.shift();
        this.isPopupOpen = false;
        unmount();

        this.activeExecutions.delete(payload.request_id);
        const inputEl = StateManager.DOM ? document.querySelector(StateManager.DOM.inputArea) as HTMLElement : null;
        if (inputEl) { inputEl.focus(); }

        globalLoggerRef?.log(`${t("hitl_rejected")}: ${payload.name}`, "error");
        this.saveToBuffer(payload.request_id, `User rejected execution. Reason: ${reason || "No reason provided."}`, true);

        this.onExecutionComplete();
        this.processConfirmationQueue();
      },
      onClose: () => {
        this.isPopupOpen = false;
        unmount();
      }
    }, 'webmcp-hitl-modal-container');
  }

  public getResultBuffer() {
    return this.resultBuffer;
  }
}
