import { BasePlatformAdapter } from './base';

export class AIStudioAdapter extends BasePlatformAdapter {
    name = 'aistudio';
    messageBlocks = '.model-response-text';
    codeBlocks = 'pre code';
    inputArea = 'rich-textarea .ql-editor';
    sendButton = 'button[aria-label*="Send"]';
    stopButton = undefined;

    matches(hostname: string): boolean {
        return hostname.includes('aistudio');
    }
}
