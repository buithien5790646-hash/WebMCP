import { BasePlatformAdapter } from './base';

export class ChatGPTAdapter extends BasePlatformAdapter {
    name = 'chatgpt';
    messageBlocks = 'div[data-message-author-role="assistant"]';
    codeBlocks = 'pre code';
    inputArea = '#prompt-textarea';
    sendButton = 'button[data-testid="send-button"]';
    stopButton = 'button[data-testid="stop-button"]';

    matches(hostname: string): boolean {
        return hostname.includes('chatgpt') || hostname.includes('openai');
    }
}
