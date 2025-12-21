import { apiClient } from "@/services/api";
import { ToolExecutionSchema } from "@/types/schemas";

export class ToolManager {
  /**
   * Prefetch and cache the tool list from Gateway
   */
  async prefetchToolList() {
    try {
      if (!apiClient.isConfigured()) return;
      await apiClient.getTools();
      // We just trigger the fetch to ensure connectivity/auth,
      // no longer caching tool list/groups or auto-protecting here.
    } catch (e) {
      console.error("[WebMCP] Tool prefetch failed:", e);
    }
  }

  /**
   * Execute a tool via ApiClient
   */
  async executeTool(name: string, args: any) {
    // Validate arguments
    const parse = ToolExecutionSchema.safeParse({ name, arguments: args });
    if (!parse.success) {
      return { success: false, error: `Invalid tool arguments: ${parse.error.message}` };
    }

    try {
      const textContent = await apiClient.executeTool(name, args || {});
      return { success: true, data: textContent };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const toolManager = new ToolManager();
