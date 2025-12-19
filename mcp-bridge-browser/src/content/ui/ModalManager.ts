import { ToolExecutionPayload } from "@/types";
import { showConfirmationModal } from "@/components/ConfirmModal";
import { logger as Logger, messageBroker, i18n } from "@/services";
const { t } = i18n;

export type ConfirmationCallback = (confirmed: boolean, payload: ToolExecutionPayload, reason?: string) => void;

export class ModalManager {
    private queue: { payload: ToolExecutionPayload; onResult: ConfirmationCallback }[] = [];
    private isPopupOpen = false;

    /**
     * Request a user confirmation for a tool execution
     */
    requestConfirmation(payload: ToolExecutionPayload, onResult: ConfirmationCallback) {
        this.queue.push({ payload, onResult });
        this.processQueue();
    }

    private processQueue() {
        if (this.isPopupOpen || this.queue.length === 0) return;

        const { payload, onResult } = this.queue[0];
        this.isPopupOpen = true;

        showConfirmationModal(
            payload,
            (isAlways) => {
                this.isPopupOpen = false;
                this.queue.shift();

                if (isAlways) {
                    this.handleAlwaysAllow(payload.name);
                }

                onResult(true, payload);
                this.processQueue();
            },
            (reason) => {
                this.isPopupOpen = false;
                this.queue.shift();
                Logger.log(`${t("hitl_rejected")}: ${payload.name}`, "error");
                onResult(false, payload, reason);
                this.processQueue();
            }
        );
    }

    private async handleAlwaysAllow(toolName: string) {
        // This logic involves coordination with the protectedTools set which is in engine.
        // We'll emit a sync event or the engine will handle it via the callback.
        // For now, we notify the background and log.
        Logger.log(`⚡ Tool '${toolName}' set to Always Allow`, "action");
        messageBroker.send({ type: "SYNC_CONFIG" }); // This will trigger storage updates if handled in BG
        // Note: The actual removal from protectedTools set should be done by the consumer (ExecutionEngine)
    }
}
