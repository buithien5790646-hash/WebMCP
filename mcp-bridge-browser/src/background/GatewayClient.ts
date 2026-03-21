import { StorageService } from '../core/storage';

/**
 * VS Code 网关客户端
 * 负责与本地 VS Code Gateway 实例进行 HTTP 通信（如拉取初始化配置、执行工具调用）
 */
export class GatewayClient {
  /**
   * 从 VS Code 网关拉取初始化数据（提示词、选择器配置等）
   * 会将拉取到的配置合并保存到本地存储中供其他模块使用
   *
   * @param port 网关 HTTP 服务器运行端口
   * @param token 连接认证令牌
   */
  static async fetchInitDataFromGateway(port: number, token: string): Promise<void> {
    try {
      console.log("[WebMCP] Fetching initialization data from Gateway...");
      // 发送 HTTP GET 请求到网关获取初始化数据
      const resp = await fetch(`http://127.0.0.1:${port}/v1/init`, {
        headers: { "X-WebMCP-Token": token },
      });
      if (!resp.ok) {
        console.warn("[WebMCP] Gateway did not respond to /v1/init (might be an older version)");
        return;
      }
      const data = await resp.json();

      // 如果返回了有效的配置数据，则覆盖本地的默认规则
      if (data.selectors && data.prompts) {
        console.log("[WebMCP] Overwriting local rules with Gateway Defaults.");

        // 保存为只读默认配置，供选项页面查看或内容脚本合并
        await StorageService.setLocal({
          defaultSelectors: data.selectors,
          ...data.prompts // 包含 prompt_en, prompt_zh, train_en... 等
        } as any);
      }
    } catch (e) {
      console.error("[WebMCP] Initialization sync failed:", e);
    }
  }

  /**
   * 向 VS Code 网关发起执行工具的请求
   *
   * @param port 网关 HTTP 服务器运行端口
   * @param token 连接认证令牌
   * @param payload 包含工具名称和参数的调用载荷
   * @returns 执行结果，包括成功状态、返回文本或错误信息
   */
  static async executeTool(port: number, token: string, payload: { name: string; arguments?: any }): Promise<{ success: boolean; data?: string; error?: string }> {
    const apiEndpoint = `http://127.0.0.1:${port}/v1/tools/call`;
    try {
      // 发送 POST 请求调用工具
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
        // 请求成功，解析返回的内容
        const resJson = await response.json();
        // 提取文本内容，如果不存在则将完整响应序列化为字符串
        const textContent = resJson.content
          ? resJson.content.map((c: any) => c.text).join("\n")
          : JSON.stringify(resJson);
        return { success: true, data: textContent };
      } else {
        // HTTP 状态不为 200 OK 时的错误处理
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
      // 网络或连接错误处理
      return { success: false, error: `Connection Failed: ${err.message}` };
    }
  }
}
