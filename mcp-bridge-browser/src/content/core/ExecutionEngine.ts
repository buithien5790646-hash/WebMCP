import { messageBroker, i18n, logger as Logger, getLocal, setLocal, setSync, ErrorHandler } from "@/services";
import { ToolExecutionPayload } from "@/types";
import {
    markVisualProcessing,
    markVisualSuccess,
    markVisualError,
    writeToInputBox,
    triggerAutoSend,
    cancelAutoSend
} from "../ui";
import { MessageParser } from "./MessageParser";
import { Workflow } from "./Workflow";

export class ExecutionEngine {
    private protectedTools = new Set<string>();
    private autoSend = true;

    constructor(
        private parser: MessageParser,
        private workflow: Workflow,
        private adapter: any // Platform adapter
    ) { }

    updateConfig(config: { autoSend: boolean; protectedTools: Set<string> }) {
        this.autoSend = config.autoSend;
        this.protectedTools = config.protectedTools;
    }

    /**
     * Main entry point to process code blocks
     */
    async processCodeBlocks(codeElements: Element[]) {
        for (const codeEl of codeElements) {
            const { payload, isStableError } = this.parser.parseCodeBlock(codeEl);

            if (payload && payload.request_id) {
                if (!this.workflow.isProcessed(payload.request_id)) {
                    this.workflow.markDiscovered(payload.request_id);
                    cancelAutoSend();
                    Logger.log(`[Engine] Captured: ${payload.name}`, "info");
                    await this.handleToolCall(payload, codeEl as HTMLElement);
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

    private async handleToolCall(payload: ToolExecutionPayload, element: HTMLElement) {
        // Check if protected
        const isProtected = this.protectedTools.has(payload.name);

        if (isProtected) {
            Logger.log(`[Engine] Protected tool detected: ${payload.name}. HITL required.`, "warn");
            return;
        }

        await this.executeTool(payload, element);
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
                    await this.handleListTools(response.data);
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

    private async handleListTools(data: string) {
        try {
            const groups = JSON.parse(data);
            const toolNames: string[] = [];
            groups.forEach((g: any) => {
                if (g.tools) g.tools.forEach((t: any) => toolNames.push(t.name));
                if (g.hidden_tools) g.hidden_tools.forEach((n: string) => toolNames.push(n));
            });

            const localData = await getLocal(["cached_tool_list"]);
            const knownTools = new Set((localData as any).cached_tool_list || []);
            let protectedDirty = false;

            toolNames.forEach((tName) => {
                if (!knownTools.has(tName) && !this.protectedTools.has(tName)) {
                    this.protectedTools.add(tName);
                    protectedDirty = true;
                }
            });

            if (protectedDirty) {
                await setSync({ protected_tools: Array.from(this.protectedTools) });
                messageBroker.send({ type: "SYNC_CONFIG" });
                Logger.log("🛡️ New tools detected & protected", "warn");
            }
            await setLocal({ cached_tool_list: toolNames });
        } catch (e) {
            console.error("[Engine] List tools processing error", e);
        }
    }
}
