import { BasePlatformAdapter } from "./base";

export class AIStudioAdapter extends BasePlatformAdapter {
  name = "aistudio";
  messageBlocks = "div[data-turn-role='Model']";
  codeBlocks = "pre code";
  inputArea = "textarea";
  sendButton = "ms-run-button button";
  stopButton = "ms-run-button button:has(.spin)";

  matches(hostname: string): boolean {
    return hostname.includes("aistudio");
  }
}
