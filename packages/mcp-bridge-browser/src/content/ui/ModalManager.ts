import { ToolExecutionPayload } from "@/types";
import { showConfirmationModal } from "@/components/ConfirmModal";
import { logger as Logger, i18n } from "@/services";
const { t } = i18n;

export type ConfirmationCallback = (
  confirmed: boolean,
  isAlways: boolean,
  payload: ToolExecutionPayload,
  reason?: string
) => void;

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

        onResult(true, isAlways, payload);
        this.processQueue();
      },
      (reason) => {
        this.isPopupOpen = false;
        this.queue.shift();
        Logger.log(`${t("hitl_rejected")}: ${payload.name}`, "error");
        onResult(false, false, payload, reason);
        this.processQueue();
      }
    );
  }
}
