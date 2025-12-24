import { messageBroker, i18n, logger as Logger, setSync, ErrorHandler } from "@/services";
const { t } = i18n;
import { ToolExecutionPayload } from "@/types";
import {
  markVisualProcessing,
  markVisualSuccess,
  markVisualError,
  writeToInputBox,
  triggerAutoSend,
  cancelAutoSend,
  ModalManager,
} from "../ui";
import { MessageParser } from "./MessageParser";
import { Workflow } from "./Workflow";

export class ExecutionEngine {
  private alwaysAllowTools = new Set<string>();
  private autoSend = true;
  private workspaceId?: string;

  constructor(
    private parser: MessageParser,
    private workflow: Workflow,
    private adapter: any, // Platform adapter
    private modalManager: ModalManager
  ) {}

  updateConfig(config: { autoSend: boolean; alwaysAllowTools: Set<string>; workspaceId?: string }) {
    this.autoSend = config.autoSend;
    this.alwaysAllowTools = config.alwaysAllowTools;
    this.workspaceId = config.workspaceId;
  }

  /**
   * Main entry point to process code blocks
   */
  processCodeBlocks(codeElements: Element[]) {
    for (const codeEl of codeElements) {
      const { payload, isStableError } = this.parser.parseCodeBlock(codeEl);

      if (payload && payload.request_id) {
        if (!this.workflow.isProcessed(payload.request_id)) {
          this.workflow.markDiscovered(payload.request_id);
          cancelAutoSend();

          // New tools (not in alwaysAllowTools) are protected by default
          if (!this.alwaysAllowTools.has(payload.name)) {
            Logger.log(`${t("hitl_intercept")}: ${payload.name}`, "warn");
            markVisualProcessing(codeEl as HTMLElement);
            this.handleProtectedTool(payload, codeEl as HTMLElement);
          } else {
            Logger.log(`[Engine] Captured: ${payload.name}`, "info");
            this.executeTool(payload, codeEl as HTMLElement);
          }
        } else if (this.workflow.isExecuting(payload.request_id)) {
          markVisualProcessing(codeEl as HTMLElement);
        } else {
          markVisualSuccess(codeEl as HTMLElement);
        }
      } else if (isStableError) {
        markVisualError(codeEl as HTMLElement);
      }
    }
  }

  private handleProtectedTool(payload: ToolExecutionPayload, element: HTMLElement) {
    this.modalManager.requestConfirmation(payload, async (confirmed, isAlways, p, reason) => {
      if (confirmed) {
        if (isAlways) {
          Logger.log(`⚡ Tool '${p.name}' set to Always Allow`, "action");
          this.alwaysAllowTools.add(p.name);
          const prefix = this.workspaceId ? `${this.workspaceId}_` : "";
          await setSync({ [`${prefix}always_allow_tools`]: Array.from(this.alwaysAllowTools) });
          messageBroker.send({ type: "SYNC_CONFIG", workspaceId: this.workspaceId });
        }
        await this.executeTool(p, element);
      } else {
        this.workflow.markCompleted(payload.request_id);
        this.workflow.saveResult(
          payload.request_id,
          `User rejected execution. Reason: ${reason || "No reason provided."}`,
          true
        );
        markVisualError(element);
      }
    });
  }

  async executeTool(payload: ToolExecutionPayload, element: HTMLElement) {
    if (payload.name === "task_completion_notification") {
      this.handleNotification(payload, element);
      return;
    }

    markVisualProcessing(element);

    try {
      const response = await messageBroker.send({
        type: "EXECUTE_TOOL",
        payload: { name: payload.name, arguments: payload.arguments },
      });

      if (response && response.success) {
        Logger.log(`[Engine] Exec Success: ${payload.name}`, "success");
        this.workflow.saveResult(payload.request_id, response.data, false);
        markVisualSuccess(element);

        // Handle list_tools caching
        if (payload.name === "list_tools") {
          await this.handleListTools(payload, response.data);
        }
      } else {
        throw new Error(response?.error || "Unknown error");
      }
    } catch (err: any) {
      try {
        ErrorHandler.report(err, "ExecutionEngine.executeTool", true);
      } catch (reportErr) {
        console.error("Critical error in ErrorHandler.report:", reportErr);
      }
      this.workflow.saveResult(payload.request_id, err.message, true);
      markVisualError(element);
    } finally {
      this.workflow.markCompleted(payload.request_id);
    }
  }

  /**
   * Finalize batch and output results
   */
  flushResults(currentTurnIds: string[]) {
    if (this.workflow.isBatchComplete(currentTurnIds)) {
      if (this.adapter.getStopButton()) return;

      const results = this.workflow.flushBatch(currentTurnIds);
      if (results.length > 0) {
        Logger.log(`[Engine] Batch finished: ${results.length} tools.`, "success");

        // Inject dynamic environment info before results
        const envInfo = `\n\n> [Environment Info]\n> Page Visible: ${!document.hidden}\n> Timestamp: ${new Date().toLocaleTimeString()}\n`;
        writeToInputBox(results.join("\n\n") + envInfo, this.adapter.inputArea);

        if (this.autoSend) {
          triggerAutoSend({ autoSend: true }, this.adapter);
        }
      }
    }
  }

  private handleNotification(payload: ToolExecutionPayload, element: HTMLElement) {
    const msg = (payload.arguments as any)?.message || "Task Completed";
    Logger.log(`🔔 Notification: ${msg}`, "action");

    if (document.hidden) {
      messageBroker.send({
        type: "SHOW_NOTIFICATION",
        title: "WebMCP Task Finished",
        message: msg,
      });
    }

    this.workflow.markCompleted(payload.request_id);
    this.workflow.saveResult(payload.request_id, "", false);
    markVisualSuccess(element);
  }

  private async handleListTools(payload: ToolExecutionPayload, data: string) {
    // We still need to save the result so the AI can see the tool list!
    this.workflow.saveResult(payload.request_id, data, false);
    Logger.log("🛠️ Tools listed and result saved", "info");
  }
}
