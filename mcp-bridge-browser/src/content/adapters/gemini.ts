import { BasePlatformAdapter } from './base';

export class GeminiAdapter extends BasePlatformAdapter {
    name = 'gemini';
    messageBlocks = 'message-content, .model-response';
    codeBlocks = 'pre code';
    inputArea = 'rich-textarea .ql-editor';
    sendButton = 'button[aria-label*="Send"]';
    stopButton = 'button[aria-label*="Stop"]';

    matches(hostname: string): boolean {
        return hostname.includes('gemini') && !hostname.includes('aistudio');
    }
}
