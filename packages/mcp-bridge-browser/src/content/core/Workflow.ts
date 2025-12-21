/**
 * Workflow Manager
 * Manages tool execution workflow, batching, and result buffering
 */
export class Workflow {
    private processedRequests = new Set<string>();
    private flushedRequests = new Set<string>();
    private activeExecutions = new Set<string>();
    private resultBuffer = new Map<string, string>();
    private toolCallCount = 0;

    /**
     * Check if a request has been processed
     */
    isProcessed(requestId: string): boolean {
        return this.processedRequests.has(requestId);
    }

    /**
     * Check if a request is currently executing
     */
    isExecuting(requestId: string): boolean {
        return this.activeExecutions.has(requestId);
    }

    /**
     * Mark a request as discovered
     */
    markDiscovered(requestId: string) {
        this.processedRequests.add(requestId);
        this.activeExecutions.add(requestId);
    }

    /**
     * Mark a request as completed
     */
    markCompleted(requestId: string) {
        this.activeExecutions.delete(requestId);
    }

    /**
     * Save result to buffer
     */
    saveResult(requestId: string, content: string, isError = false) {
        const responseJson: any = {
            mcp_action: 'result',
            request_id: requestId,
            status: isError ? 'error' : 'success',
        };

        if (isError) {
            responseJson.error = content;
        } else {
            responseJson.output = content;
        }

        this.toolCallCount++;

        // Add training hint every 5 calls
        if (this.toolCallCount > 0 && this.toolCallCount % 5 === 0) {
            responseJson.system_note = '[System] Reminder: Tool calls MUST use JSON format.';
        }

        const jsonString = `\`\`\`json\n${JSON.stringify(responseJson, null, 2)}\n\`\`\``;
        this.resultBuffer.set(requestId, jsonString);
    }

    /**
     * Get result from buffer
     */
    getResult(requestId: string): string | undefined {
        return this.resultBuffer.get(requestId);
    }

    /**
     * Check if all requests in a batch are completed
     */
    isBatchComplete(requestIds: string[]): boolean {
        const actionableIds = requestIds.filter(id => !this.flushedRequests.has(id));
        if (actionableIds.length === 0) return false;

        const completedCount = actionableIds.filter(
            id => !this.activeExecutions.has(id) && this.resultBuffer.has(id)
        ).length;

        return completedCount === actionableIds.length;
    }

    /**
     * Flush results for a batch of requests
     */
    flushBatch(requestIds: string[]): string[] {
        const actionableIds = requestIds.filter(id => !this.flushedRequests.has(id));
        const results: string[] = [];

        actionableIds.forEach(id => {
            const result = this.resultBuffer.get(id);
            if (result) {
                results.push(result);
            }
            this.resultBuffer.delete(id);
            this.flushedRequests.add(id);
        });

        return results;
    }

    /**
     * Get batch progress
     */
    getBatchProgress(requestIds: string[]): { completed: number; total: number } {
        const actionableIds = requestIds.filter(id => !this.flushedRequests.has(id));
        const completedCount = actionableIds.filter(
            id => !this.activeExecutions.has(id) && this.resultBuffer.has(id)
        ).length;

        return {
            completed: completedCount,
            total: actionableIds.length,
        };
    }

    /**
     * Reset all workflow state
     */
    reset() {
        this.processedRequests.clear();
        this.flushedRequests.clear();
        this.activeExecutions.clear();
        this.resultBuffer.clear();
        this.toolCallCount = 0;
    }
}
