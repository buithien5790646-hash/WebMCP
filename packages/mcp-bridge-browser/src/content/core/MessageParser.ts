import { ToolExecutionPayload } from '@/types';

/**
 * Message Parser
 * Handles JSON parsing and validation of tool execution payloads
 */
export class MessageParser {
    private static readonly NON_STANDARD_SPACES = /[\u00a0\uFEFF\u200B]/g;
    private static readonly STABILIZATION_TIMEOUT = 3000;

    private blockStates = new WeakMap<Element, { text: string; time: number; errorNotified: boolean }>();

    /**
     * Parse a code block and extract tool execution payload
     */
    parseCodeBlock(codeElement: Element): { payload: ToolExecutionPayload | null; error?: string; isStableError?: boolean } {
        const textContent = (codeElement.textContent || '').trim();

        // Quick check: must contain mcp_action
        if (!textContent.includes('"mcp_action": "call"')) {
            return { payload: null };
        }

        // Clean non-standard whitespace characters
        const cleanedText = textContent.replace(MessageParser.NON_STANDARD_SPACES, ' ');

        try {
            const payload = JSON.parse(cleanedText);

            // Clear any previous error state
            if (this.blockStates.has(codeElement)) {
                this.blockStates.delete(codeElement);
            }

            // Validate payload structure
            if (payload.mcp_action === 'call' && payload.request_id) {
                return { payload: payload as ToolExecutionPayload };
            }

            return { payload: null };
        } catch (e) {
            // JSON parse error - implement stabilization logic
            const errorInfo = this.handleParseError(codeElement, textContent, e as Error);
            return {
                payload: null,
                error: (e as Error).message,
                isStableError: !!errorInfo?.isStableError
            };
        }
    }

    /**
     * Handle JSON parse errors with stabilization logic
     */
    private handleParseError(codeElement: Element, textContent: string, error: Error) {
        const now = Date.now();
        const state = this.blockStates.get(codeElement);

        if (!state || state.text !== textContent) {
            // Text changed, reset timer
            this.blockStates.set(codeElement, {
                text: textContent,
                time: now,
                errorNotified: false,
            });

            // Clear any previous error styling
            const el = codeElement as HTMLElement;
            if (el.dataset.mcpState === 'error') {
                el.style.border = 'none';
                delete el.dataset.mcpState;
                delete el.dataset.mcpVisual;
            }
        } else {
            // Text stable, check if timeout reached
            if (now - state.time > MessageParser.STABILIZATION_TIMEOUT && !state.errorNotified) {
                console.error('[MCP] JSON Parse Error (Stable):', error.message);
                state.errorNotified = true;
                this.blockStates.set(codeElement, state);

                // Return error info for visual feedback
                return {
                    isStableError: true,
                    message: error.message,
                };
            }
        }

        return null;
    }

    /**
     * Clear all parser state
     */
    reset() {
        this.blockStates = new WeakMap();
    }
}
