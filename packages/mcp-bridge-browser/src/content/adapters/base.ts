/**
 * Platform Adapter Interface
 * Defines platform-specific selectors and behaviors
 */
export interface PlatformAdapter {
    name: string;
    messageBlocks: string;
    codeBlocks: string;
    inputArea: string;
    sendButton: string;
    stopButton?: string;
}

/**
 * Base adapter with common functionality
 */
export abstract class BasePlatformAdapter implements PlatformAdapter {
    abstract name: string;
    abstract messageBlocks: string;
    abstract codeBlocks: string;
    abstract inputArea: string;
    abstract sendButton: string;
    abstract stopButton?: string;

    /**
     * Check if this adapter matches the current page
     */
    abstract matches(hostname: string): boolean;

    /**
     * Get input element
     */
    getInputElement(): HTMLElement | null {
        return document.querySelector(this.inputArea);
    }

    /**
     * Get send button element
     */
    getSendButton(): HTMLElement | null {
        return document.querySelector(this.sendButton);
    }

    /**
     * Get stop button element (if exists)
     */
    getStopButton(): HTMLElement | null {
        if (!this.stopButton) return null;
        return document.querySelector(this.stopButton);
    }

    /**
     * Get all message blocks
     */
    getMessageBlocks(): NodeListOf<Element> {
        return document.querySelectorAll(this.messageBlocks);
    }

    /**
     * Get code blocks from an element
     */
    getCodeBlocks(element: Element): NodeListOf<Element> {
        return element.querySelectorAll(this.codeBlocks);
    }
}
