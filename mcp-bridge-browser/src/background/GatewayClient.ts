import { StorageService } from '../core/storage';

export class GatewayClient {
  /**
   * Fetch initialization data (prompts, selectors) from the VS Code gateway.
   */
  static async fetchInitDataFromGateway(port: number, token: string): Promise<void> {
    try {
      console.log("[WebMCP] Fetching initialization data from Gateway...");
      const resp = await fetch(`http://127.0.0.1:${port}/v1/init`, {
        headers: { "X-WebMCP-Token": token },
      });
      if (!resp.ok) {
        console.warn("[WebMCP] Gateway did not respond to /v1/init (might be an older version)");
        return;
      }
      const data = await resp.json();

      if (data.selectors && data.prompts) {
        console.log("[WebMCP] Overwriting local rules with Gateway Defaults.");

        // Save pure defaults for Read-Only access in options or merging in content
        await StorageService.setLocal({
          defaultSelectors: data.selectors,
          ...data.prompts // prompt_en, prompt_zh, train_en... etc.
        } as any);
      }
    } catch (e) {
      console.error("[WebMCP] Initialization sync failed:", e);
    }
  }

  /**
   * Execute a tool against the VS Code gateway.
   */
  static async executeTool(port: number, token: string, payload: { name: string; arguments?: any }): Promise<{ success: boolean; data?: string; error?: string }> {
    const apiEndpoint = `http://127.0.0.1:${port}/v1/tools/call`;
    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WebMCP-Token": token,
        },
        body: JSON.stringify({
          name: payload.name,
          arguments: payload.arguments || {},
        }),
      });

      if (response.ok) {
        const resJson = await response.json();
        const textContent = resJson.content
          ? resJson.content.map((c: any) => c.text).join("\n")
          : JSON.stringify(resJson);
        return { success: true, data: textContent };
      } else {
        if (response.status === 403) {
          return { success: false, error: "Session Expired/Invalid Token." };
        } else {
          return {
            success: false,
            error: `${response.status} - ${response.statusText}`,
          };
        }
      }
    } catch (err: any) {
      return { success: false, error: `Connection Failed: ${err.message}` };
    }
  }
}
