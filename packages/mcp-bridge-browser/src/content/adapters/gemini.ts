import { BasePlatformAdapter } from "./base";

export class GeminiAdapter extends BasePlatformAdapter {
  name = "gemini";
  messageBlocks = ".markdown";
  codeBlocks = "pre code";
  inputArea = 'div[contenteditable="true"]';
  sendButton = 'button[aria-label="发送"], button[aria-label="Send"], button[aria-label*="Send"]';
  stopButton = 'button[aria-label*="Stop"], button[aria-label*="停止"]';

  matches(hostname: string): boolean {
    return hostname.includes("gemini") && !hostname.includes("aistudio");
  }
}
