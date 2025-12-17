/**
 * 平台适配器接口
 * 用于屏蔽 VS Code 与 Electron/Desktop 之间的差异
 */

// 日志接口
export interface IGatewayLogger {
    info(message: string): void;
    error(message: string, error?: any): void;
    appendLine(message: string): void;
}

// 持久化存储接口 (对应 VS Code globalState 或 Electron Store)
export interface IGatewayStorage {
    get(key: string): Promise<any | undefined>;
    update(key: string, value: any): Promise<void>;
}

// 单个 MCP 服务器的配置
export interface ServerConfig {
    type?: 'stdio' | 'sse' | 'http';
    command?: string;
    args?: string[];
    url?: string;
    headers?: Record<string, string>;
    env?: Record<string, string>;
    disabled?: boolean;
}

// 网关启动配置
export interface GatewayConfig {
    port: number;
    preferredPort?: number;
    mcpServers: Record<string, ServerConfig>;
    allowedOrigins: string[];
}

// 启动结果
export interface StartResult {
    port: number;
    token: string;
}

// 运行时上下文
export interface IRuntimeContext {
    extensionPath: string; // 插件或应用根路径
    getWorkspaceRoot(): string | null; // 当前工作区路径 (用于相对路径解析)
}
