import { browserService } from './BrowserService';

export type MessageHandler = (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
) => void | boolean | Promise<void | any>;

/**
 * MessageBroker
 * Standardizes communication between extension components
 */
export class MessageBroker {
    private handlers: Map<string, MessageHandler[]> = new Map();

    constructor() {
        this.initListner();
    }

    private initListner() {
        browserService.onMessage((message, sender, sendResponse) => {
            const type = message?.type;
            if (!type) return false;

            const typeHandlers = this.handlers.get(type);
            if (!typeHandlers || typeHandlers.length === 0) return false;

            // In Chrome extensions, only one handler can send a response.
            // We assume the first registered handler for a type takes responsibility.
            let isAsync = false;
            for (const handler of typeHandlers) {
                const result = handler(message, sender, sendResponse);
                if (result === true) {
                    isAsync = true;
                }
            }
            return isAsync;
        });
    }

    /**
     * Subscribe to a specific message type
     * @returns A function to unsubscribe
     */
    on(type: string, handler: MessageHandler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type)!.push(handler);

        return () => {
            const list = this.handlers.get(type);
            if (list) {
                const index = list.indexOf(handler);
                if (index > -1) list.splice(index, 1);
            }
        };
    }

    /**
     * Send a message through browserService
     */
    async send(message: { type: string;[key: string]: any }, tabId?: number): Promise<any> {
        return browserService.sendMessage(message, tabId);
    }
}

export const messageBroker = new MessageBroker();
