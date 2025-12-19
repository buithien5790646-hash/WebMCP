import { BasePlatformAdapter } from './base';

export class ChatGPTAdapter extends BasePlatformAdapter {
    name = 'chatgpt';
    messageBlocks = 'div[data-message-author-role], article';
    codeBlocks = 'pre code';
    inputArea = '#prompt-textarea, div[contenteditable="true"]';
    sendButton = 'button[data-testid="send-button"]';
    stopButton = 'button[data-testid="stop-button"]';

    matches(hostname: string): boolean {
        return hostname.includes('chatgpt') || hostname.includes('openai');
    }
}
