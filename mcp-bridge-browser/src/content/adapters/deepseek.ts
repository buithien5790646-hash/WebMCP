import { BasePlatformAdapter } from './base';

export class DeepseekAdapter extends BasePlatformAdapter {
    name = 'deepseek';
    messageBlocks = '.ds-message';
    codeBlocks = 'pre';
    inputArea = 'textarea.ds-scroll-area';
    sendButton = "div[role='button']:has(path[d^='M8.3125'])";
    stopButton = "div[role='button']:has(path[d^='M2 4.88'])";

    matches(hostname: string): boolean {
        return hostname.includes('deepseek');
    }
}
