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
    ModalManager
} from "../ui";
import { MessageParser } from "./MessageParser";
import { Workflow } from "./Workflow";

export class ExecutionEngine {
    private protectedTools = new Set<string>();
    private autoSend = true;

    constructor(
        private parser: MessageParser,
        private workflow: Workflow,
        private adapter: any, // Platform adapter
        private modalManager: ModalManager
    ) { }

    updateConfig(config: { autoSend: boolean; protectedTools: Set<string> }) {
        this.autoSend = config.autoSend;
        this.protectedTools = config.protectedTools;
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

                    if (this.protectedTools.has(payload.name)) {
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
                    this.protectedTools.delete(p.name);
                    await setSync({ protected_tools: Array.from(this.protectedTools) });
                    messageBroker.send({ type: "SYNC_CONFIG" });
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
            this.handleNotification(payload);
            return;
        }

        markVisualProcessing(element);

        try {
            const response = await messageBroker.send({
                type: "EXECUTE_TOOL",
                payload: { name: payload.name, arguments: payload.arguments }
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
            ErrorHandler.report(err, "ExecutionEngine.executeTool", true);
            this.workflow.saveResult(payload.request_id, err.message, true);
            markVisualError(element);
            writeToInputBox(`${i18n.resources.error}\n${err.message}`, this.adapter.inputArea);
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
                writeToInputBox(results.join("\n\n"), this.adapter.inputArea);
                if (this.autoSend) {
                    triggerAutoSend({ autoSend: true }, this.adapter);
                }
            }
        }
    }

    private handleNotification(payload: ToolExecutionPayload) {
        const msg = (payload.arguments as any)?.message || "Task Completed";
        Logger.log(`🔔 Notification: ${msg}`, "action");
        messageBroker.send({
            type: "SHOW_NOTIFICATION",
            title: "WebMCP Task Finished",
            message: msg,
        });
        this.workflow.markCompleted(payload.request_id);
        this.workflow.saveResult(payload.request_id, "", false);
    }

    private async handleListTools(payload: ToolExecutionPayload, data: string) {
        // We still need to save the result so the AI can see the tool list!
        this.workflow.saveResult(payload.request_id, data, false);
        Logger.log("🛠️ Tools listed and result saved", "info");
    }
}
