import { BasePlatformAdapter } from "./base";
import { DeepseekAdapter } from "./deepseek";
import { ChatGPTAdapter } from "./chatgpt";
import { GeminiAdapter } from "./gemini";
import { AIStudioAdapter } from "./aistudio";

export { BasePlatformAdapter } from "./base";
export { DeepseekAdapter } from "./deepseek";
export { ChatGPTAdapter } from "./chatgpt";
export { GeminiAdapter } from "./gemini";
export { AIStudioAdapter } from "./aistudio";

const adapters: BasePlatformAdapter[] = [
  new DeepseekAdapter(),
  new ChatGPTAdapter(),
  new GeminiAdapter(),
  new AIStudioAdapter(),
];

/**
 * Detect and return the appropriate platform adapter for the current page
 */
export function detectPlatform(): BasePlatformAdapter | null {
  const hostname = location.hostname;

  for (const adapter of adapters) {
    if (adapter.matches(hostname)) {
      return adapter;
    }
  }

  return null;
}
