/**
 * Common configuration for WebMCP
 */
export interface WebMCPConfig {
  prompt: string;
  rules: string;
  train: string;
  error_hint: string;
  protected_tools?: string[];
}

/**
 * Configuration for an individual MCP server
 */
export interface ServerConfig {
  type?: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  disabled?: boolean;
}

/**
 * Configuration for the MCP Gateway
 */
export interface GatewayConfig {
  port: number;
  preferredPort?: number;
  mcpServers: Record<string, ServerConfig>;
  allowedOrigins?: string[];
  enabledServices?: string[];
}

/**
 * Result of starting the gateway
 */
export interface StartResult {
  port: number;
  token: string;
}

/**
 * Tool execution request payload
 * Used for Browser -> Extension -> Gateway link
 */
export interface ToolExecutionPayload {
  name: string;
  arguments: any;
  request_id?: string;
  purpose?: string;
}

/**
 * Standard MCP response format
 */
export interface McpResponse {
  mcp_action: "result";
  request_id: string;
  status: "success" | "error";
  output?: string;
  error?: string;
  system_note?: string;
}

/**
 * Session connection info
 */
export interface Session {
  port: number;
  token: string;
  showLog: boolean;
}
