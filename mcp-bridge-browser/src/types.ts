// === Shared Types ===

export interface Session {
  port: number;
  token: string;
  showLog?: boolean;
}

export interface ToolExecutionPayload {
  mcp_action: 'call';
  request_id: string;
  name: string;
  arguments?: Record<string, any>;
  purpose?: string;
}

// === Extension-Internal Types ===

export interface MessageRequest {
  type: string;
  tabId?: number;
  port?: number;
  token?: string;
  force?: boolean;
  show?: boolean;
  title?: string;
  message?: string;
  payload?: ToolExecutionPayload;
}

export interface HandshakeResponse {
  success: boolean;
  error?: string;
  conflictTabId?: string;
}
