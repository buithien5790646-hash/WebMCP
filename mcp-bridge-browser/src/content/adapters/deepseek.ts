import { BasePlatformAdapter } from './base';

export class DeepseekAdapter extends BasePlatformAdapter {
    name = 'deepseek';
    messageBlocks = 'div[class*="MessageItem"]';
    codeBlocks = 'pre code, .code-block code';
    inputArea = 'div[contenteditable="true"]';
    sendButton = 'button[aria-label*="Send"], button[type="submit"]';
    stopButton = 'button[aria-label*="Stop"]';

    matches(hostname: string): boolean {
        return hostname.includes('deepseek');
    }
}
