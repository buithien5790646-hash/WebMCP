import { PlatformAdapter } from './PlatformAdapter';
import { StateManager } from './StateManager';
import { globalLoggerRef } from '../../components/Logger';
import { t } from '../../core/i18n';

export class ResponseBatcher {
  private flushedRequests = new Set<string>();
  private lastProgressLogTime = 0;
  private lastProgressStatus = "";

  constructor(
    private adapter: PlatformAdapter,
    private activeExecutions: Set<string>,
    private resultBuffer: Map<string, string>,
    private triggerRetry: () => void
  ) { }

  public processBatch(actionableIds: string[]) {
    const unFlushedIds = actionableIds.filter((id) => !this.flushedRequests.has(id));
    if (unFlushedIds.length === 0) {return;}

    const completedCount = unFlushedIds.filter(
      (id) => !this.activeExecutions.has(id) && this.resultBuffer.has(id)
    ).length;
    const totalCount = unFlushedIds.length;

    // Fix 3: Wait for all known tools to finish
    if (completedCount === totalCount) {
      // Fix 4: Check if AI is still generating (Stop button check)
      if (this.adapter.isGenerating()) {
        this.triggerRetry();
        return;
      }

      const orderedResults: string[] = [];
      let hasUnflushedContent = false;
      unFlushedIds.forEach((id) => {
        const res = this.resultBuffer.get(id);
        if (res) {
          orderedResults.push(res);
          hasUnflushedContent = true;
        }
      });

      if (hasUnflushedContent && StateManager.DOM) {
        globalLoggerRef?.log(`Batch finished: ${orderedResults.length} tools. Writing...`, "success");
        this.adapter.writeToInput(orderedResults.join("\n\n"));
        unFlushedIds.forEach((id) => {
          this.resultBuffer.delete(id);
          this.flushedRequests.add(id);
        });
        this.adapter.triggerSend();
      } else {
        // Pure virtual tools (no output)
        const anyVirtual = unFlushedIds.some((id) => this.resultBuffer.has(id));
        if (anyVirtual) {
          unFlushedIds.forEach((id) => {
            this.resultBuffer.delete(id);
            this.flushedRequests.add(id);
          });
        }
      }
      this.lastProgressStatus = "";
    } else {
      // Waiting
      const statusStr = `${completedCount}/${totalCount}`;
      const now = Date.now();
      if (statusStr !== this.lastProgressStatus || now - this.lastProgressLogTime > 3000) {
        globalLoggerRef?.log(`${t("waiting_tools")} (${statusStr})`, "warn");
        this.lastProgressStatus = statusStr;
        this.lastProgressLogTime = now;
      }
    }
  }
}
